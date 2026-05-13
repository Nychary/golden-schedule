import { createClient } from '@supabase/supabase-js';
import type { Lesson, Subject } from './types';

const STORAGE_KEY = 'tutor-scheduler-lessons-v1';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

type LessonRow = {
  id: string;
  student: string;
  subject: Subject;
  lesson_date: string;
  lesson_time: string;
  note: string | null;
};

export const scheduleStorageMode = supabase ? 'online' : 'local';

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

function isSameSlot(first: Lesson, second: Lesson) {
  return first.date === second.date && first.time === second.time;
}

function sortLessons(lessons: Lesson[]) {
  return [...lessons].sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`));
}
