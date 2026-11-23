import { useState } from 'react';
import { useParams } from 'react-router';
import { MatchHeader, UsageNote } from '@/components/prep/MatchHeader';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';
import { useUsage } from '@/features/cv/api';
import { useJobMatch } from '@/features/jobs/api';
import { useCoverLetter, useSaveCoverLetter, useWriteCoverLetter } from '@/features/prep/api';
import { LENGTHS, TONES, type CoverLetter, type Length, type Tone } from '@/features/prep/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const toneInfo: Record<Tone, { label: string; text: string }> = {
  professional: { label: 'Professional', text: 'Polished and formal' },
  warm: { label: 'Warm', text: 'Friendly and enthusiastic' },
  confident: { label: 'Confident', text: 'Direct, leads with results' },
};
const lengthInfo: Record<Length, { label: string; text: string }> = {
  short: { label: 'Short', text: '~200 words' },
  standard: { label: 'Standard', text: '~300 words' },
};

const steps = [
  'Reading the job description…',
  'Picking your most relevant experience…',
  'Writing your opening…',
  'Connecting your skills to the role…',
  'Polishing the letter…',
];

const fieldClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30';

export default function CoverLetterPage() {
  const { id } = useParams<{ id: string }>();
  const match = useJobMatch(id!);
  const letter = useCoverLetter(id!);
  const usage = useUsage();
  const write = useWriteCoverLetter();

  // Options start from the last letter's settings, if there is one.
  const [tone, setTone] = useState<Tone | null>(null);
  const [length, setLength] = useState<Length | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const current = {
    tone: tone ?? letter.data?.tone ?? 'professional',
    length: length ?? letter.data?.length ?? 'standard',
    notes: notes ?? letter.data?.notes ?? '',
  };

  if (match.isLoading || letter.isLoading) {
    return (
      <div className="flex justify-center py-24 text-brand-300">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (match.error || !match.data) {
    return (
      <Alert>
        {match.error instanceof ApiError ? match.error.message : 'We could not load this job.'}
      </Alert>
    );
  }

  const existing = letter.data ?? null;
  const counter = usage.data?.coverLetter;
  const outOfUses = counter?.remaining === 0;

  function handleWrite() {
    if (
      existing?.edited &&
      !window.confirm('Write a new letter? Your edits to the current one will be replaced.')
    ) {
      return;
    }
    write.mutate({ jobMatchId: id!, ...current });
  }

  return (
    <div>
      {write.isPending && <ProgressOverlay title="Writing your cover letter" steps={steps} />}

      <MatchHeader
        match={match.data}
        eyebrow="Cover letter"
        description="A tailored letter written from your CV and this job description."
      />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        {/* Options */}
        <section className="space-y-5 rounded-2xl border border-white/10 bg-surface/70 p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">Tone</legend>
            <div className="space-y-2">
              {TONES.map((t) => (
                <Choice
                  key={t}
                  name="tone"
                  checked={current.tone === t}
                  onChange={() => setTone(t)}
                  label={toneInfo[t].label}
                  text={toneInfo[t].text}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">Length</legend>
            <div className="grid grid-cols-2 gap-2">
              {LENGTHS.map((l) => (
                <Choice
                  key={l}
                  name="length"
                  checked={current.length === l}
                  onChange={() => setLength(l)}
                  label={lengthInfo[l].label}
                  text={lengthInfo[l].text}
                />
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">
              Anything to mention? <span className="text-slate-500">(optional)</span>
            </span>
            <textarea
              rows={4}
              maxLength={600}
              value={current.notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I'm relocating to Lagos in January. I use their app every day."
              className={cn(fieldClass, 'resize-y')}
            />
            <span className="mt-1 block text-right text-[11px] text-slate-500">
              {current.notes.length}/600
            </span>
          </label>

          {write.isError && (
            <Alert>
              {write.error instanceof ApiError
                ? write.error.message
                : "We couldn't write your letter. Please try again."}
            </Alert>
          )}

          <Button className="w-full" onClick={handleWrite} disabled={outOfUses}>
            {existing ? 'Write a new version' : 'Write my cover letter'}
          </Button>
          <UsageNote counter={counter} what="cover letters" />
        </section>

        {/* Letter */}
        {existing ? (
          <LetterEditor key={existing.updatedAt} letter={existing} />
        ) : (
          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-surface/40 p-8 text-center">
            <p className="font-display text-lg font-semibold text-white">No letter yet</p>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Choose a tone and length, then let Ribra write a first draft. It uses only real
              experience from your CV, and you can edit every word.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
  text,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  text: string;
}) {
  return (
    <label className="block cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="block rounded-lg border border-white/10 px-3 py-2 transition peer-checked:border-brand-400 peer-checked:bg-brand-500/10 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 hover:bg-white/5">
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="block text-xs text-slate-400">{text}</span>
      </span>
    </label>
  );
}

function LetterEditor({ letter }: { letter: CoverLetter }) {
  const save = useSaveCoverLetter();
  const [draft, setDraft] = useState(letter.content);
  const dirty = draft.trim() !== letter.content.trim();
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  function download() {
    const name = [letter.jobTitle, letter.company].filter(Boolean).join(' - ');
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover letter - ${name}.txt`.replace(/[\\/:*?"<>|]/g, '');
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-surface/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3">
        <p className="text-xs text-slate-500">
          {words} words · {toneInfo[letter.tone].label.toLowerCase()} tone
          {letter.edited && ' · edited by you'}
        </p>
        <div className="flex items-center gap-4">
          <CopyButton text={draft} />
          <button
            type="button"
            onClick={download}
            className="text-xs font-medium text-slate-400 hover:text-white"
          >
            Download .txt
          </button>
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            disabled={!dirty || !draft.trim()}
            loading={save.isPending}
            onClick={() => save.mutate({ id: letter.id, content: draft })}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {save.isError && (
        <div className="px-5 pt-4">
          <Alert>
            {save.error instanceof ApiError
              ? save.error.message
              : "We couldn't save your changes. Please try again."}
          </Alert>
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Your cover letter"
        rows={22}
        className="block w-full resize-y bg-transparent px-6 py-5 font-serif text-[15px] leading-7 text-slate-100 outline-none"
      />
      <p className="border-t border-white/5 px-5 py-3 text-xs text-slate-500">
        Read it through before sending: AI can get details wrong. Written by {letter.model}.
      </p>
    </section>
  );
}
