export const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'] as const;
export type ApplicationStatus = (typeof STATUSES)[number];

export type Application = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  location: string;
  jobUrl: string;
  salary: string;
  notes: string;
  appliedAt: string | null;
  nextStep: string;
  nextStepAt: string | null;
  jobMatchId: string | null;
  matchScore: number | null;
  history: Array<{ status: ApplicationStatus; at: string }>;
  createdAt: string;
  updatedAt: string;
};

/** What the form sends. Dates are "YYYY-MM-DD" or null. */
export type ApplicationInput = {
  company: string;
  role: string;
  status: ApplicationStatus;
  location: string;
  jobUrl: string;
  salary: string;
  notes: string;
  appliedAt: string | null;
  nextStep: string;
  nextStepAt: string | null;
};
