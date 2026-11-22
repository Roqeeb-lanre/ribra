import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  detectFileType,
  extractResumeText,
  normaliseText,
} from '../src/modules/resumes/extractText.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

describe('detectFileType', () => {
  it('recognises PDF, Word and text files by their content', () => {
    expect(detectFileType(fixture('sample-cv.pdf'), 'cv.pdf')).toBe('pdf');
    expect(detectFileType(fixture('sample-cv.docx'), 'cv.docx')).toBe('docx');
    expect(detectFileType(fixture('sample-cv.txt'), 'cv.txt')).toBe('txt');
  });

  it('is not fooled by a renamed file', () => {
    expect(detectFileType(fixture('sample-cv.docx'), 'cv.pdf')).toBeNull();
    expect(detectFileType(Buffer.from('MZ\x90\x00binary'), 'virus.exe')).toBeNull();
  });
});

describe('extractResumeText', () => {
  it.each([
    ['pdf', 'sample-cv.pdf'],
    ['docx', 'sample-cv.docx'],
    ['txt', 'sample-cv.txt'],
  ] as const)('reads the text out of a %s CV', async (type, file) => {
    const text = await extractResumeText(fixture(file), type);
    expect(text).toContain('Junior Developer');
    expect(text).toContain('MongoDB');
  });

  it('rejects files with almost no text (e.g. scanned images)', async () => {
    await expect(extractResumeText(Buffer.from('Hello'), 'txt')).rejects.toMatchObject({
      code: 'CV_UNREADABLE',
    });
  });
});

describe('normaliseText', () => {
  it('collapses extra spaces and blank lines', () => {
    expect(normaliseText('a  b\r\n\n\n\nc\t d')).toBe('a b\n\nc d');
  });
});
