import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api';
import { cvKeys } from '@/features/cv/api';
import type { CoverLetter, InterviewPrep, InterviewPrepSummary, Length, Tone } from './types';

export const prepKeys = {
  letters: ['cover-letters'] as const,
  letter: (matchId: string) => ['cover-letters', 'match', matchId] as const,
  preps: ['interview-preps'] as const,
  prep: (matchId: string) => ['interview-preps', 'match', matchId] as const,
};

/** "Not created yet" is a normal state, not an error. */
function nullIfNotFound(err: unknown): null {
  if (err instanceof ApiError && err.status === 404) return null;
  throw err;
}

// ---- Cover letters ----

export function useCoverLetters() {
  return useQuery({
    queryKey: prepKeys.letters,
    queryFn: () =>
      apiRequest<{ coverLetters: CoverLetter[] }>('/cover-letters').then((d) => d.coverLetters),
  });
}

export function useCoverLetter(matchId: string) {
  return useQuery({
    queryKey: prepKeys.letter(matchId),
    queryFn: () =>
      apiRequest<{ coverLetter: CoverLetter }>(`/cover-letters/by-match/${matchId}`)
        .then((d) => d.coverLetter)
        .catch(nullIfNotFound),
  });
}

export function useWriteCoverLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { jobMatchId: string; tone: Tone; length: Length; notes: string }) =>
      apiRequest<{ coverLetter: CoverLetter }>('/cover-letters', { method: 'POST', body: input }),
    onSuccess: ({ coverLetter }) => {
      queryClient.setQueryData(prepKeys.letter(coverLetter.jobMatchId), coverLetter);
      void queryClient.invalidateQueries({ queryKey: prepKeys.letters, exact: true });
      void queryClient.invalidateQueries({ queryKey: cvKeys.usage });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: cvKeys.usage }),
  });
}

export function useSaveCoverLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiRequest<{ coverLetter: CoverLetter }>(`/cover-letters/${id}`, {
        method: 'PATCH',
        body: { content },
      }),
    onSuccess: ({ coverLetter }) => {
      queryClient.setQueryData(prepKeys.letter(coverLetter.jobMatchId), coverLetter);
      void queryClient.invalidateQueries({ queryKey: prepKeys.letters, exact: true });
    },
  });
}

// ---- Interview prep ----

export function useInterviewPreps() {
  return useQuery({
    queryKey: prepKeys.preps,
    queryFn: () =>
      apiRequest<{ interviewPreps: InterviewPrepSummary[] }>('/interview-preps').then(
        (d) => d.interviewPreps,
      ),
  });
}

export function useInterviewPrep(matchId: string) {
  return useQuery({
    queryKey: prepKeys.prep(matchId),
    queryFn: () =>
      apiRequest<{ interviewPrep: InterviewPrep }>(`/interview-preps/by-match/${matchId}`)
        .then((d) => d.interviewPrep)
        .catch(nullIfNotFound),
  });
}

function useStorePrep() {
  const queryClient = useQueryClient();
  return (prep: InterviewPrep) => {
    queryClient.setQueryData(prepKeys.prep(prep.jobMatchId), prep);
    void queryClient.invalidateQueries({ queryKey: prepKeys.preps, exact: true });
    void queryClient.invalidateQueries({ queryKey: cvKeys.usage });
  };
}

export function useGenerateInterviewPrep() {
  const queryClient = useQueryClient();
  const store = useStorePrep();
  return useMutation({
    mutationFn: (jobMatchId: string) =>
      apiRequest<{ interviewPrep: InterviewPrep }>('/interview-preps', {
        method: 'POST',
        body: { jobMatchId },
      }),
    onSuccess: ({ interviewPrep }) => store(interviewPrep),
    onError: () => void queryClient.invalidateQueries({ queryKey: cvKeys.usage }),
  });
}

export function useReviewAnswer() {
  const queryClient = useQueryClient();
  const store = useStorePrep();
  return useMutation({
    mutationFn: ({
      prepId,
      questionId,
      answer,
    }: {
      prepId: string;
      questionId: string;
      answer: string;
    }) =>
      apiRequest<{ interviewPrep: InterviewPrep }>(
        `/interview-preps/${prepId}/questions/${questionId}/feedback`,
        { method: 'POST', body: { answer } },
      ),
    onSuccess: ({ interviewPrep }) => store(interviewPrep),
    onError: () => void queryClient.invalidateQueries({ queryKey: cvKeys.usage }),
  });
}
