import type { ApplicationStatus } from './types';

export const statusMeta: Record<
  ApplicationStatus,
  { label: string; hint: string; dot: string; badge: string }
> = {
  saved: {
    label: 'Saved',
    hint: 'Jobs you want to apply for',
    dot: 'bg-slate-400',
    badge: 'bg-slate-400/15 text-slate-300',
  },
  applied: {
    label: 'Applied',
    hint: 'Waiting to hear back',
    dot: 'bg-sky-400',
    badge: 'bg-sky-400/15 text-sky-300',
  },
  interview: {
    label: 'Interview',
    hint: 'In the interview process',
    dot: 'bg-brand-400',
    badge: 'bg-brand-400/15 text-brand-200',
  },
  offer: {
    label: 'Offer',
    hint: 'You got an offer 🎉',
    dot: 'bg-success',
    badge: 'bg-success/15 text-emerald-300',
  },
  rejected: {
    label: 'Rejected',
    hint: 'Not this time',
    dot: 'bg-danger',
    badge: 'bg-danger/15 text-rose-300',
  },
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Dates like the applied date and next-step date are calendar days (no time),
 * stored as midnight UTC. Compare them with today's date in the user's own time zone.
 */
export function daysFromToday(isoDate: string, now = new Date()): number {
  const day = Date.parse(isoDate.slice(0, 10));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day - today) / DAY);
}

/** "Today", "Tomorrow", "In 3 days", "2 days ago", or a date for anything further away. */
export function relativeDay(isoDate: string, now = new Date()): string {
  const days = daysFromToday(isoDate, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < -1 && days >= -7) return `${-days} days ago`;
  return formatDay(isoDate);
}

export function formatDay(isoDate: string): string {
  return new Date(isoDate.slice(0, 10)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Colour for a next-step date: overdue is red, within 3 days is amber. */
export function dueTone(isoDate: string, now = new Date()): 'overdue' | 'soon' | 'later' {
  const days = daysFromToday(isoDate, now);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'soon';
  return 'later';
}

/** "2026-12-02" for a date input. */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
