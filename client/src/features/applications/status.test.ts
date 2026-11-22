import { describe, expect, it } from 'vitest';
import { daysFromToday, dueTone, relativeDay, toDateInput } from './status';

// Noon on 10 March 2027, in the test machine's own time zone.
const now = new Date(2027, 2, 10, 12, 0, 0);

describe('next-step dates', () => {
  it('counts calendar days from today', () => {
    expect(daysFromToday('2027-03-10T00:00:00.000Z', now)).toBe(0);
    expect(daysFromToday('2027-03-12T00:00:00.000Z', now)).toBe(2);
    expect(daysFromToday('2027-03-08T00:00:00.000Z', now)).toBe(-2);
  });

  it('describes dates in words', () => {
    expect(relativeDay('2027-03-10T00:00:00.000Z', now)).toBe('Today');
    expect(relativeDay('2027-03-11T00:00:00.000Z', now)).toBe('Tomorrow');
    expect(relativeDay('2027-03-09T00:00:00.000Z', now)).toBe('Yesterday');
    expect(relativeDay('2027-03-14T00:00:00.000Z', now)).toBe('In 4 days');
    expect(relativeDay('2027-03-05T00:00:00.000Z', now)).toBe('5 days ago');
  });

  it('flags overdue and upcoming steps', () => {
    expect(dueTone('2027-03-09T00:00:00.000Z', now)).toBe('overdue');
    expect(dueTone('2027-03-13T00:00:00.000Z', now)).toBe('soon');
    expect(dueTone('2027-03-20T00:00:00.000Z', now)).toBe('later');
  });

  it('formats for date inputs', () => {
    expect(toDateInput('2027-03-10T00:00:00.000Z')).toBe('2027-03-10');
    expect(toDateInput(null)).toBe('');
  });
});
