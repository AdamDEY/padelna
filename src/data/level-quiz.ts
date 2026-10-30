// Level quiz in profile setup step 3. Answers run from the lowest level (0) to the highest (4).
// The wording lives in the language files, under quiz.<id>.
export const QUIZ_IDS = [
  "frequency",
  "experience",
  "training",
  "serve",
  "net",
  "walls",
  "overhead",
  "competition",
] as const;

export type QuizQuestion = { id: (typeof QUIZ_IDS)[number] };

/** The five answers every question has, lowest level first */
export const ANSWER_INDEXES = [0, 1, 2, 3, 4] as const;

export const levelQuizQuestions: QuizQuestion[] = QUIZ_IDS.map((id) => ({ id }));
