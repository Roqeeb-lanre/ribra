export type JobKeyword = { keyword: string; importance: 'required' | 'preferred'; found: boolean };

export type JobMatchSummary = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  jobTitle: string;
  company: string | null;
  matchScore: number;
  createdAt: string;
};

export type JobMatch = JobMatchSummary & {
  seniority: string | null;
  jobDescription: string;
  fitScore: number;
  keywordCoverage: number;
  keywords: JobKeyword[];
  verdict: string;
  strengths: string[];
  gaps: string[];
  tailoringTips: Array<{ section: string; tip: string }>;
  suggestedSummary: string;
  model: string;
};

export type CreateJobMatchInput = {
  resumeId: string;
  jobDescription: string;
  jobTitle?: string;
  company?: string;
};
