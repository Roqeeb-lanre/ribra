/** Colour and label for a 0-100 score, shared by the ring, bars and lists. */
export function scoreTone(score: number) {
  if (score >= 80)
    return { label: 'Excellent', text: 'text-success', bar: 'bg-success', stroke: '#10b981' };
  if (score >= 65)
    return { label: 'Good', text: 'text-brand-300', bar: 'bg-brand-400', stroke: '#8b7cff' };
  if (score >= 50)
    return { label: 'Needs work', text: 'text-warning', bar: 'bg-warning', stroke: '#f59e0b' };
  return { label: 'Weak', text: 'text-danger', bar: 'bg-danger', stroke: '#f43f5e' };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
