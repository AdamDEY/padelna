// Level quiz in profile setup step 3. Answers run from the lowest level (0) to the highest (4).
export type QuizQuestion = { title: string; answers: string[] };

const allQuestions: QuizQuestion[] = [
  {
    title: "How often do you play padel?",
    answers: [
      "A few times a year",
      "Once or twice a month",
      "Once a week",
      "2–3 times a week",
      "4+ times a week",
    ],
  },
  {
    title: "How long have you been playing?",
    answers: [
      "Less than 3 months",
      "3 to 12 months",
      "1 to 3 years",
      "3 to 5 years",
      "More than 5 years",
    ],
  },
  {
    title: "What is your training background?",
    answers: [
      "Self-taught, never had lessons",
      "A few group lessons",
      "Regular group training",
      "Private coaching sessions",
      "Intensive / professional training",
    ],
  },
  {
    title: "How would you describe your serve and return?",
    answers: [
      "I struggle to get serves in",
      "I serve in, little control over placement",
      "I place serves and return most shots",
      "I vary serves and return with depth",
      "I dominate with aggressive serves and returns",
    ],
  },
  {
    title: "How comfortable are you at the net?",
    answers: [
      "I avoid going to the net",
      "I go, but make many mistakes",
      "I volley both sides with some difficulty",
      "Confident, well placed, clean volleys",
      "Deep, powerful volleys and quick reflexes",
    ],
  },
  {
    title: "How well do you handle wall rebounds?",
    answers: [
      "I hit before the ball reaches the wall",
      "I try back-wall returns with difficulty",
      "Back wall fine, double wall is hard",
      "I return double-wall balls and fast rebounds",
      "I attack off the wall (bajada) on both sides",
    ],
  },
  {
    title: "How would you rate your overhead game?",
    answers: [
      "I rarely play overheads",
      "I try bandejas but lack consistency",
      "Decent bandejas and basic smashes",
      "Effective bandejas / víboras, reliable smash",
      "Powerful x3 / x4 smashes, precise víboras",
    ],
  },
  {
    title: "What level do you compete at?",
    answers: [
      "Only casual games",
      "Friendly club tournaments",
      "Local amateur leagues",
      "Regional competitions",
      "National / federation tournaments",
    ],
  },
  {
    title: "How would you describe your serve and return?",
    answers: [
      "I struggle to get serves in",
      "I serve in, little control over placement",
      "I place serves and return most shots",
      "I vary serves and return with depth",
      "I dominate with aggressive serves and returns",
    ],
  },
  {
    title: "How comfortable are you at the net?",
    answers: [
      "I avoid going to the net",
      "I go, but make many mistakes",
      "I volley both sides with some difficulty",
      "Confident, well placed, clean volleys",
      "Deep, powerful volleys and quick reflexes",
    ],
  },
  {
    title: "How well do you handle wall rebounds?",
    answers: [
      "I hit before the ball reaches the wall",
      "I try back-wall returns with difficulty",
      "Back wall fine, double wall is hard",
      "I return double-wall balls and fast rebounds",
      "I attack off the wall (bajada) on both sides",
    ],
  },
  {
    title: "How would you rate your overhead game?",
    answers: [
      "I rarely play overheads",
      "I try bandejas but lack consistency",
      "Decent bandejas and basic smashes",
      "Effective bandejas / víboras, reliable smash",
      "Powerful x3 / x4 smashes, precise víboras",
    ],
  },
  {
    title: "What level do you compete at?",
    answers: [
      "Only casual games",
      "Friendly club tournaments",
      "National / federation tournaments",
    ],
  },
];

// The full quiz has 8 questions; we start with the first 3
const ACTIVE_QUESTION_COUNT = 8;

export const levelQuizQuestions = allQuestions.slice(0, ACTIVE_QUESTION_COUNT);
