import type { Lesson, Student, Subject } from './types';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'tutor-scheduler-lessons-v1';
const STUDENTS_STORAGE_KEY = 'tutor-scheduler-students-v1';

type LessonRow = {
  id: string;
  student: string;
  subject: Subject;
  lesson_date: string;
  lesson_time: string;
  note: string | null;
};

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  subject: Subject;
};

export const scheduleStorageMode = supabase ? 'online' : 'local';

export const INITIAL_STUDENTS: Student[] = [
  { id: 'student-1', firstName: 'Ярослав', lastName: '', subject: 'english' },
  { id: 'student-2', firstName: 'Маша', lastName: '', subject: 'english' },
  { id: 'student-3', firstName: 'Даша', lastName: '', subject: 'english' },
  { id: 'student-4', firstName: 'Артём', lastName: '', subject: 'physics' },
  { id: 'student-5', firstName: 'Катя', lastName: '1', subject: 'physics' },
  { id: 'student-6', firstName: 'Катя', lastName: '2', subject: 'physics' },
  { id: 'student-7', firstName: 'Миша', lastName: '', subject: 'physics' },
  { id: 'student-8', firstName: 'Соня', lastName: '', subject: 'physics' },
];

export const INITIAL_LESSONS: Lesson[] = [
  {
    id: 'sample-1',
    student: 'Маша',
    subject: 'english',
    date: getTodayIso(),
    time: '10:00',
    note: 'Повторить Past Simple',
  },
  {
    id: 'sample-2',
    student: 'Илья',
    subject: 'physics',
    date: addDays(getTodayIso(), 1),
    time: '16:00',
    note: 'Задачи на силу трения',
  },
];

export function getTodayIso() {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

export async function loadStudents(): Promise<Student[]> {
  if (!supabase) {
    return readLocalStudents();
  }

  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, subject')
    .order('subject', { ascending: true })
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true });

  if (error) {
    return readLocalStudents();
  }

  return (data ?? []).map(rowToStudent);
}

export async function saveStudent(student: Student): Promise<Student> {
  if (!supabase) {
    const students = readLocalStudents();
    const nextStudents = sortStudents([
      ...students.filter((item) => item.id !== student.id),
      student,
    ]);
    writeLocalStudents(nextStudents);
    return student;
  }

  const { data, error } = await supabase
    .from('students')
    .upsert(studentToRow(student), { onConflict: 'id' })
    .select('id, first_name, last_name, subject')
    .single();

  if (error) {
    const students = readLocalStudents();
    const nextStudents = sortStudents([
      ...students.filter((item) => item.id !== student.id),
      student,
    ]);
    writeLocalStudents(nextStudents);
    return student;
  }

  return rowToStudent(data);
}

export async function removeStudent(studentId: string): Promise<void> {
  if (!supabase) {
    writeLocalStudents(readLocalStudents().filter((student) => student.id !== studentId));
    return;
  }

  const { error } = await supabase.from('students').delete().eq('id', studentId);

  if (error) {
    writeLocalStudents(readLocalStudents().filter((student) => student.id !== studentId));
  }
}

export async function loadLessons(): Promise<Lesson[]> {
  if (!supabase) {
    return readLocalLessons();
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('id, student, subject, lesson_date, lesson_time, note')
    .order('lesson_date', { ascending: true })
    .order('lesson_time', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(rowToLesson);
}

export async function saveLesson(lesson: Lesson): Promise<Lesson> {
  if (!supabase) {
    const lessons = readLocalLessons();
    const nextLessons = sortLessons([
      ...lessons.filter((item) => item.id !== lesson.id && !isSameSlot(item, lesson)),
      lesson,
    ]);
    writeLocalLessons(nextLessons);
    return lesson;
  }

  const { error: slotError } = await supabase
    .from('lessons')
    .delete()
    .eq('lesson_date', lesson.date)
    .eq('lesson_time', lesson.time)
    .neq('id', lesson.id);

  if (slotError) {
    throw slotError;
  }

  const { data, error } = await supabase
    .from('lessons')
    .upsert(lessonToRow(lesson), { onConflict: 'id' })
    .select('id, student, subject, lesson_date, lesson_time, note')
    .single();

  if (error) {
    throw error;
  }

  return rowToLesson(data);
}

export async function saveLessons(lessonsToSave: Lesson[]): Promise<Lesson[]> {
  if (!supabase) {
    const lessons = readLocalLessons();
    const ids = new Set(lessonsToSave.map((lesson) => lesson.id));
    const nextLessons = sortLessons([
      ...lessons.filter((lesson) => !ids.has(lesson.id)),
      ...lessonsToSave,
    ]);
    writeLocalLessons(nextLessons);
    return lessonsToSave;
  }

  const { data, error } = await supabase
    .from('lessons')
    .upsert(lessonsToSave.map(lessonToRow), { onConflict: 'id' })
    .select('id, student, subject, lesson_date, lesson_time, note');

  if (error) {
    throw error;
  }

  return (data ?? []).map(rowToLesson);
}

export async function removeLesson(lessonId: string): Promise<void> {
  if (!supabase) {
    writeLocalLessons(readLocalLessons().filter((lesson) => lesson.id !== lessonId));
    return;
  }

  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);

  if (error) {
    throw error;
  }
}

function readLocalLessons() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Lesson[]) : INITIAL_LESSONS;
  } catch {
    return INITIAL_LESSONS;
  }
}

function writeLocalLessons(lessons: Lesson[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortLessons(lessons)));
}

function readLocalStudents() {
  try {
    const stored = localStorage.getItem(STUDENTS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Student[]) : INITIAL_STUDENTS;
  } catch {
    return INITIAL_STUDENTS;
  }
}

function writeLocalStudents(students: Student[]) {
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(sortStudents(students)));
}

function lessonToRow(lesson: Lesson) {
  return {
    id: lesson.id,
    student: lesson.student,
    subject: lesson.subject,
    lesson_date: lesson.date,
    lesson_time: lesson.time,
    note: lesson.note,
  };
}

function studentToRow(student: Student) {
  return {
    id: student.id,
    first_name: student.firstName,
    last_name: student.lastName,
    subject: student.subject,
  };
}

function rowToLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    student: row.student,
    subject: row.subject,
    date: row.lesson_date,
    time: row.lesson_time.slice(0, 5),
    note: row.note ?? '',
  };
}

function rowToStudent(row: StudentRow): Student {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name ?? '',
    subject: row.subject,
  };
}

function isSameSlot(first: Lesson, second: Lesson) {
  return first.date === second.date && first.time === second.time;
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

function formatStudentName(student: Student) {
  return [student.firstName, student.lastName].filter(Boolean).join(' ');
}
