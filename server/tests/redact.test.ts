import { describe, expect, it } from 'vitest';
import { redactContactDetails } from '../src/ai/redact.js';

describe('redactContactDetails', () => {
  it('removes emails, phone numbers and profile links', () => {
    const input =
      'Ada | ada.okafor@example.com | +234 803 123 4567 | linkedin.com/in/ada-okafor | https://ada.dev';
    const output = redactContactDetails(input);

    expect(output).not.toContain('example.com');
    expect(output).not.toContain('803');
    expect(output).not.toContain('ada-okafor');
    expect(output).toContain('[email]');
    expect(output).toContain('[phone]');
    expect(output).toContain('[link]');
  });

  it('keeps years, date ranges and percentages', () => {
    const input = 'Junior Developer (2024 - Present). Cut load time by 40% across 3 pages.';
    expect(redactContactDetails(input)).toBe(input);
  });
});
