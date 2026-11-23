export type Resume = {
  id: string;
  title: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  fileSize: number;
  wordCount: number;
  latestScore: number | null;
  createdAt: string;
};

export type AnalysisSummary = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  targetRole: string | null;
  overallScore: number;
  detectedRole: string;
  createdAt: string;
};

export type Analysis = AnalysisSummary & {
  scores: { ats: number; impact: number; skills: number; structure: number; clarity: number };
  experienceLevel: 'student' | 'entry' | 'mid' | 'senior';
  summary: string;
  strengths: string[];
  improvements: Array<{ priority: 'high' | 'medium' | 'low'; title: string; detail: string }>;
  sections: Array<{ name: string; score: number; feedback: string }>;
  improvedBullets: Array<{ original: string; improved: string; reason: string }>;
  skills: { technical: string[]; soft: string[]; missing: string[] };
  model: string;
};

export type Usage = {
  period: string;
  plan: 'free' | 'pro';
  cvAnalysis: UsageCounter;
  jobMatch: UsageCounter;
  coverLetter: UsageCounter;
  interviewPrep: UsageCounter;
  answerFeedback: UsageCounter;
};

export type UsageCounter = { used: number; limit: number | null; remaining: number | null };
