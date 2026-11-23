export const TONES = ['professional', 'warm', 'confident'] as const;
export const LENGTHS = ['short', 'standard'] as const;
export type Tone = (typeof TONES)[number];
export type Length = (typeof LENGTHS)[number];

export type CoverLetter = {
  id: string;
  jobMatchId: string;
  jobTitle: string;
  company: string | null;
  tone: Tone;
  length: Length;
  notes: string;
  content: string;
  edited: boolean;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type QuestionCategory = 'motivation' | 'behavioural' | 'technical' | 'role';

export type AnswerFeedback = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  improvedAnswer: string;
  at: string;
};

export type InterviewQuestion = {
  id: string;
  category: QuestionCategory;
  question: string;
  whyTheyAsk: string;
  howToAnswer: string;
  cvPoints: string[];
  answer: string;
  feedback: AnswerFeedback | null;
};

export type InterviewPrep = {
  id: string;
  jobMatchId: string;
  jobTitle: string;
  company: string | null;
  questions: InterviewQuestion[];
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type InterviewPrepSummary = {
  id: string;
  jobMatchId: string;
  jobTitle: string;
  company: string | null;
  questionCount: number;
  practisedCount: number;
  updatedAt: string;
};
