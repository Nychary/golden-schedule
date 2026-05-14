import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, KeyRound, LogOut, Plus, RefreshCw, Save, Sparkles, Trash2, UserPlus, Users, X } from 'lucide-react';
import type { DraftLesson, DraftStudent, Lesson, Student, Subject } from './types';
import zhongliTeacher from './assets/zhongli-teacher-glasses.png';
import {
  addDays,
  getTodayIso,
  loadLessons,
  loadStudents,
  removeLesson,
  removeStudent,
  saveLesson as saveLessonToStorage,
  saveLessons,
  saveStudent as saveStudentToStorage,
  scheduleStorageMode,
} from './scheduleStorage';
import { supabase } from './supabaseClient';

const dayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });
const fullDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const DISPLAY_HOURS = Array.from({ length: 12 }, (_, index) => index + 9);
const TIME_OPTIONS = DISPLAY_HOURS.flatMap((hour) => ['00', '20', '40'].map((minutes) => `${String(hour).padStart(2, '0')}:${minutes}`)).filter(
  (time) => time <= '20:00',
);
const SUBJECT_LABELS: Record<Subject, string> = {
  english: 'Английский',
  physics: 'Физика',
};

function startOfWeek(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function getWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function toHourTime(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function getHourSlotTime(time: string) {
  return toHourTime(Number(time.slice(0, 2)));
}

function createEmptyLesson(date: string, time: string): DraftLesson {
  return {
    student: '',
    subject: 'english',
    date,
    time,
    note: '',
  };
}

function createEmptyStudent(): DraftStudent {
  return {
    firstName: '',
    lastName: '',
    subject: 'english',
  };
}

function formatStudentName(student: Student | DraftStudent) {
  return [student.firstName.trim(), student.lastName.trim()].filter(Boolean).join(' ');
}

function sortLessons(lessons: Lesson[]) {
  return [...lessons].sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`));
}

function sortStudents(students: Student[]) {
  return [...students].sort((first, second) => {
    const subjectOrder = first.subject.localeCompare(second.subject);
    if (subjectOrder !== 0) {
      return subjectOrder;
    }

    return formatStudentName(first).localeCompare(formatStudentName(second), 'ru');
  });
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(getTodayIso()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [draft, setDraft] = useState<DraftLesson | null>(null);
  const [studentDraft, setStudentDraft] = useState<DraftStudent>(() => createEmptyStudent());
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  async function refreshLessons() {
    setIsLoading(true);
    setStatusMessage('');

    try {
      const loadedLessons = await loadLessons();
      setLessons(sortLessons(loadedLessons));
    } catch {
      setStatusMessage('Не удалось загрузить расписание. Проверь Supabase-настройки.');
    } finally {
      setIsLoading(false);
    }
  }

  function clearPrivateState() {
    setLessons([]);
    setStudents([]);
    setDraft(null);
    setIsStudentManagerOpen(false);
    setDraggedLessonId(null);
    setStatusMessage('');
  }

  async function refreshStudents() {
    try {
      const loadedStudents = await loadStudents();
      setStudents(sortStudents(loadedStudents));
    } catch {
      setStudents([]);
    }
  }

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setIsAuthenticated(true);
      setIsAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setIsAuthenticated(Boolean(data.session));
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setIsAuthLoading(false);

      if (!session) {
        clearPrivateState();
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void refreshLessons();
    void refreshStudents();

    function refreshOnFocus() {
      if (scheduleStorageMode === 'online') {
        void refreshLessons();
        void refreshStudents();
      }
    }

    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [isAuthenticated]);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const currentWeekLabel = `${dateFormatter.format(new Date(`${weekDays[0]}T12:00:00`))} - ${dateFormatter.format(
    new Date(`${weekDays[6]}T12:00:00`),
  )}`;

  const lessonsBySlot = useMemo(() => {
    return lessons.reduce<Record<string, Lesson[]>>((slots, lesson) => {
      const slotKey = `${lesson.date}-${getHourSlotTime(lesson.time)}`;
      slots[slotKey] = [...(slots[slotKey] ?? []), lesson].sort((first, second) => first.time.localeCompare(second.time));
      return slots;
    }, {});
  }, [lessons]);

  const studentsBySubject = useMemo(() => {
    return students.reduce<Record<Subject, Student[]>>(
      (groups, student) => {
        groups[student.subject] = [...groups[student.subject], student];
        return groups;
      },
      { english: [], physics: [] },
    );
  }, [students]);

  const studentOptions = useMemo(() => {
    if (!draft) {
      return [];
    }

    const subjectStudents = studentsBySubject[draft.subject].map(formatStudentName);
    return draft.student && !subjectStudents.includes(draft.student) ? [draft.student, ...subjectStudents] : subjectStudents;
  }, [draft, studentsBySubject]);

  function openEditor(date: string, time: string) {
    const existingLesson = lessons.find((lesson) => lesson.date === date && lesson.time === time);
    setDraft(existingLesson ?? createEmptyLesson(date, time));
  }

  function closeEditor() {
    setDraft(null);
  }

  function updateDraftSubject(subject: Subject) {
    if (!draft) {
      return;
    }

    const subjectStudents = studentsBySubject[subject].map(formatStudentName);
    setDraft({
      ...draft,
      subject,
      student: subjectStudents.includes(draft.student) ? draft.student : '',
    });
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setIsAuthenticated(true);
      setAuthError('');
      setPassword('');
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError('Не удалось войти. Проверь email и пароль.');
    } else {
      setPassword('');
    }

    setIsAuthSubmitting(false);
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setIsAuthenticated(false);
    clearPrivateState();
  }

  async function refreshEverything() {
    await Promise.all([refreshLessons(), refreshStudents()]);
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !draft.student.trim()) {
      return;
    }

    const normalizedLesson: Lesson = {
      id: draft.id ?? crypto.randomUUID(),
      student: draft.student.trim(),
      subject: draft.subject,
      date: draft.date,
      time: draft.time,
      note: draft.note.trim(),
    };

    const previousLessons = lessons;
    const optimisticLessons = sortLessons([
      ...lessons.filter((lesson) => lesson.id !== normalizedLesson.id && (lesson.date !== normalizedLesson.date || lesson.time !== normalizedLesson.time)),
      normalizedLesson,
    ]);

    setLessons(optimisticLessons);
    setIsSaving(true);
    setStatusMessage('');
    closeEditor();

    try {
      await saveLessonToStorage(normalizedLesson);
      await refreshLessons();
    } catch {
      setLessons(previousLessons);
      setStatusMessage('Не удалось сохранить урок. Попробуй еще раз.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLesson(lessonId: string) {
    const previousLessons = lessons;

    setLessons((currentLessons) => currentLessons.filter((lesson) => lesson.id !== lessonId));
    setIsSaving(true);
    setStatusMessage('');
    closeEditor();

    try {
      await removeLesson(lessonId);
    } catch {
      setLessons(previousLessons);
      setStatusMessage('Не удалось удалить урок. Попробуй еще раз.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedStudent: Student = {
      id: crypto.randomUUID(),
      firstName: studentDraft.firstName.trim(),
      lastName: studentDraft.lastName.trim(),
      subject: studentDraft.subject,
    };

    if (!normalizedStudent.firstName) {
      return;
    }

    const normalizedName = formatStudentName(normalizedStudent).toLocaleLowerCase('ru');
    const hasDuplicate = students.some(
      (student) => student.subject === normalizedStudent.subject && formatStudentName(student).toLocaleLowerCase('ru') === normalizedName,
    );

    if (hasDuplicate) {
      setStatusMessage('Такой ученик уже есть в выбранном предмете.');
      return;
    }

    const previousStudents = students;

    setStudents(sortStudents([...students, normalizedStudent]));
    setStudentDraft(createEmptyStudent());
    setIsSaving(true);
    setStatusMessage('');

    try {
      await saveStudentToStorage(normalizedStudent);
      await refreshStudents();
    } catch {
      setStudents(previousStudents);
      setStatusMessage('Не удалось сохранить ученика. Попробуй еще раз.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteStudent(studentId: string) {
    const deletedStudent = students.find((student) => student.id === studentId);
    const previousStudents = students;

    setStudents((currentStudents) => currentStudents.filter((student) => student.id !== studentId));
    setStatusMessage('');
    setIsSaving(true);

    if (draft && deletedStudent && draft.student === formatStudentName(deletedStudent)) {
      setDraft({ ...draft, student: '' });
    }

    try {
      await removeStudent(studentId);
    } catch {
      setStudents(previousStudents);
      setStatusMessage('Не удалось удалить ученика. Попробуй еще раз.');
    } finally {
      setIsSaving(false);
    }
  }

  async function moveLesson(lessonId: string, date: string, time: string) {
    const movedLesson = lessons.find((lesson) => lesson.id === lessonId);
    const targetLesson = lessons.find((lesson) => lesson.id !== lessonId && lesson.date === date && lesson.time === time);

    if (!movedLesson || (movedLesson.date === date && movedLesson.time === time)) {
      return;
    }

    const changedLessons = targetLesson
      ? [
          { ...movedLesson, date, time },
          { ...targetLesson, date: movedLesson.date, time: movedLesson.time },
        ]
      : [{ ...movedLesson, date, time }];

    const previousLessons = lessons;
    const changedLessonIds = new Set(changedLessons.map((lesson) => lesson.id));
    const optimisticLessons = sortLessons([
      ...lessons.filter((lesson) => !changedLessonIds.has(lesson.id)),
      ...changedLessons,
    ]);

    setLessons(optimisticLessons);
    setIsSaving(true);
    setStatusMessage('');

    try {
      await saveLessons(changedLessons);
      await refreshLessons();
    } catch {
      setLessons(previousLessons);
      setStatusMessage('Не удалось перенести урок. Попробуй еще раз.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="app-shell login-shell">
        <section className="login-card" aria-label="Проверка сессии">
          <div className="login-copy">
            <p className="eyebrow">
              <Sparkles size={15} />
              Золотой распорядок
            </p>
            <h1>Проверяю доступ</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="app-shell login-shell">
        <section className="login-card" aria-label="Вход в расписание">
          <div className="login-copy">
            <p className="eyebrow">
              <Sparkles size={15} />
              Золотой распорядок
            </p>
            <h1>Контракт ожидает подписи</h1>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                autoComplete="email"
                autoFocus
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Пароль
              <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {authError && <p className="auth-error">{authError}</p>}
            <button type="submit" className="primary-button" disabled={isAuthSubmitting}>
              <KeyRound size={17} />
              {isAuthSubmitting ? 'Вхожу...' : 'Войти'}
            </button>
          </form>
        </section>

        <aside className="character-panel login-character" aria-label="Декоративный портрет Чжун Ли">
          <img src={zhongliTeacher} alt="Чжун Ли" />
        </aside>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="layout-shell">
        <div className="schedule-panel">
          <header className="topbar">
            <div className="hero-copy">
              <p className="eyebrow">
                <Sparkles size={15} />
                Золотой распорядок
              </p>
              <p className="hero-line">Контракты соблюдаются, уроки выполняются</p>
            </div>
            <div className="week-controls" aria-label="Навигация по неделям">
              <button type="button" className="icon-button" onClick={() => setIsStudentManagerOpen(true)} title="Ученики">
                <Users size={18} />
              </button>
              <button type="button" className="icon-button" onClick={handleLogout} title="Выйти">
                <LogOut size={17} />
              </button>
              <button type="button" className="icon-button" onClick={() => setWeekStart(addDays(weekStart, -7))} title="Предыдущая неделя">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="today-button" onClick={() => setWeekStart(startOfWeek(getTodayIso()))}>
                Сегодня
              </button>
              <button type="button" className="icon-button" onClick={() => setWeekStart(addDays(weekStart, 7))} title="Следующая неделя">
                <ChevronRight size={18} />
              </button>
            </div>
          </header>

          <section className="calendar-toolbar" aria-label="Текущая неделя">
            <div>
              <strong>{currentWeekLabel}</strong>
              <span>{lessons.length} занятий</span>
              <span>{students.length} учеников</span>
            </div>
            <div className="storage-status" data-mode={scheduleStorageMode}>
              <span>{scheduleStorageMode === 'online' ? 'Контракт записан' : 'Локальный черновик'}</span>
              <button type="button" className="icon-button small-icon-button" onClick={() => void refreshEverything()} title="Обновить данные">
                <RefreshCw size={16} />
              </button>
            </div>
          </section>

          {statusMessage && <p className="status-message">{statusMessage}</p>}

          <section className="calendar" aria-label="Недельное расписание">
            <div className="calendar-grid calendar-header">
              <div className="time-heading">Время</div>
              {weekDays.map((day) => (
                <div className="day-heading" key={day}>
                  <span>{dayFormatter.format(new Date(`${day}T12:00:00`))}</span>
                  <strong>{dateFormatter.format(new Date(`${day}T12:00:00`))}</strong>
                </div>
              ))}
            </div>

            {DISPLAY_HOURS.map((hour) => {
              const time = toHourTime(hour);
              return (
                <div className="calendar-grid calendar-row" key={time}>
                  <div className="time-cell">{time}</div>
                  {weekDays.map((day) => {
                    const slotLessons = lessonsBySlot[`${day}-${time}`] ?? [];

                    return (
                      <button
                        type="button"
                        className={`slot ${slotLessons.length ? 'has-lesson' : ''}`}
                        key={`${day}-${time}`}
                        onClick={() => openEditor(day, time)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggedLessonId) {
                            const draggedLesson = lessons.find((lesson) => lesson.id === draggedLessonId);
                            const targetTime =
                              draggedLesson && time !== '20:00' ? `${time.slice(0, 2)}:${draggedLesson.time.slice(3, 5)}` : time;
                            void moveLesson(draggedLessonId, day, targetTime);
                            setDraggedLessonId(null);
                          }
                        }}
                        aria-label={`Ячейка ${fullDateFormatter.format(new Date(`${day}T12:00:00`))}, ${time}`}
                        disabled={isLoading || isSaving}
                      >
                        {slotLessons.length ? (
                          <span className="slot-lessons">
                            {slotLessons.map((lesson) => (
                              <article
                                className={`lesson-card subject-${lesson.subject}`}
                                draggable={!isSaving}
                                key={lesson.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditor(day, lesson.time);
                                }}
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  setDraggedLessonId(lesson.id);
                                }}
                                onDragEnd={() => setDraggedLessonId(null)}
                              >
                                <span>
                                  {SUBJECT_LABELS[lesson.subject]} · {lesson.time}
                                </span>
                                <strong>{lesson.student}</strong>
                                {lesson.note && <small>{lesson.note}</small>}
                                <Edit3 size={15} aria-hidden="true" />
                              </article>
                            ))}
                          </span>
                        ) : (
                          <span className="empty-slot">
                            <Plus size={15} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {isLoading && <div className="calendar-state">Загружаю расписание...</div>}
          </section>
        </div>

        <aside className="character-panel" aria-label="Декоративный портрет Чжун Ли">
          <img src={zhongliTeacher} alt="Чжун Ли" />
        </aside>
      </div>

      {draft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeEditor}>
          <form className="lesson-modal" onSubmit={saveLesson} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>{fullDateFormatter.format(new Date(`${draft.date}T12:00:00`))}</p>
                <h2>{draft.id ? 'Редактировать урок' : 'Новый урок'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeEditor} title="Закрыть">
                <X size={18} />
              </button>
            </header>

            <label>
              Предмет
              <select autoFocus value={draft.subject} onChange={(event) => updateDraftSubject(event.target.value as Subject)}>
                <option value="english">Английский</option>
                <option value="physics">Физика</option>
              </select>
            </label>

            <label>
              Ученик
              <select value={draft.student} onChange={(event) => setDraft({ ...draft, student: event.target.value })} required>
                <option value="" disabled>
                  Выбери ученика
                </option>
                {studentOptions.map((student) => (
                  <option value={student} key={student}>
                    {student}
                  </option>
                ))}
              </select>
            </label>
            {!studentOptions.length && (
              <button type="button" className="link-button" onClick={() => setIsStudentManagerOpen(true)}>
                Добавить ученика
              </button>
            )}

            <div className="modal-row">
              <label>
                Дата
                <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </label>
              <label>
                Начало
                <select value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })}>
                  {TIME_OPTIONS.map((time) => (
                    <option value={time} key={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Заметка
              <textarea
                value={draft.note}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                placeholder="Что пройти, что подготовить"
                rows={3}
              />
            </label>

            <footer>
              {draft.id && (
                <button type="button" className="danger-button" onClick={() => void deleteLesson(draft.id!)}>
                  <Trash2 size={17} />
                  Удалить
                </button>
              )}
              <button type="submit" className="primary-button" disabled={isSaving}>
                <Save size={17} />
                Сохранить
              </button>
            </footer>
          </form>
        </div>
      )}

      {isStudentManagerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsStudentManagerOpen(false)}>
          <section className="lesson-modal student-modal" aria-label="Управление учениками" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>{students.length} учеников в списке</p>
                <h2>Ученики</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsStudentManagerOpen(false)} title="Закрыть">
                <X size={18} />
              </button>
            </header>

            <form className="student-form" onSubmit={saveStudent}>
              <div className="student-form-grid">
                <label>
                  Имя
                  <input
                    autoFocus
                    value={studentDraft.firstName}
                    onChange={(event) => setStudentDraft({ ...studentDraft, firstName: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Фамилия
                  <input value={studentDraft.lastName} onChange={(event) => setStudentDraft({ ...studentDraft, lastName: event.target.value })} />
                </label>
                <label>
                  Предмет
                  <select value={studentDraft.subject} onChange={(event) => setStudentDraft({ ...studentDraft, subject: event.target.value as Subject })}>
                    <option value="english">Английский</option>
                    <option value="physics">Физика</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="primary-button" disabled={isSaving}>
                <UserPlus size={17} />
                Добавить
              </button>
            </form>

            <div className="student-lists">
              {(Object.keys(SUBJECT_LABELS) as Subject[]).map((subject) => (
                <section className="student-group" key={subject} aria-label={SUBJECT_LABELS[subject]}>
                  <h3>{SUBJECT_LABELS[subject]}</h3>
                  {studentsBySubject[subject].length ? (
                    <ul>
                      {studentsBySubject[subject].map((student) => (
                        <li key={student.id}>
                          <span>{formatStudentName(student)}</span>
                          <button type="button" className="icon-button small-icon-button" onClick={() => void deleteStudent(student.id)} title="Удалить ученика">
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-students">Пока никого</p>
                  )}
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
