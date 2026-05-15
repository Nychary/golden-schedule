export type Subject = 'english' | 'physics';

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  subject: Subject;
  pricePerLesson: number;
};

export type Lesson = {
  id: string;
  student: string;
  subject: Subject;
  date: string;
  time: string;
  note: string;
};

export type DraftLesson = Omit<Lesson, 'id'> & { id?: string };

export type DraftStudent = Omit<Student, 'id'>;
