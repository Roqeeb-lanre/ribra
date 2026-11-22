import { describe, expect, it } from 'vitest';
import { formatBytes, scoreTone } from './score';

describe('scoreTone', () => {
  it('labels scores by band', () => {
    expect(scoreTone(92).label).toBe('Excellent');
    expect(scoreTone(70).label).toBe('Good');
    expect(scoreTone(55).label).toBe('Needs work');
    expect(scoreTone(30).label).toBe('Weak');
  });
});

describe('formatBytes', () => {
  it('shows human-friendly sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
