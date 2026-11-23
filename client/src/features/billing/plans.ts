/** What each plan includes per month. Must match the server's defaults in config/env.ts. */
export const PRO_PRICE_NGN = 5000;

export const planLimits = {
  free: { cvAnalysis: 5, jobMatch: 5, coverLetter: 5, interviewPrep: 5, answerFeedback: 30 },
  pro: { cvAnalysis: 50, jobMatch: 50, coverLetter: 50, interviewPrep: 50, answerFeedback: 300 },
};

export const featureLabels: Record<keyof typeof planLimits.free, string> = {
  cvAnalysis: 'AI CV analyses',
  jobMatch: 'Job matches',
  coverLetter: 'Cover letters',
  interviewPrep: 'Interview prep sets',
  answerFeedback: 'Practice answer reviews',
};

export const formatNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;
