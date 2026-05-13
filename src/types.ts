export type Subject = 'english' | 'physics';

export type Lesson = {
  id: string;
  student: string;
  subject: Subject;
  date: string;
  time: string;
  note: string;
};

export type DraftLesson = Omit<Lesson, 'id'> & { id?: string };
