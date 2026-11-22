import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';
import { AppError } from '../../utils/AppError.js';

export type ResumeFileType = 'pdf' | 'docx' | 'txt';

const MIN_CHARACTERS = 200;
const MAX_CHARACTERS = 30_000;

/**
 * Works out the real file type from its first bytes ("magic numbers"),
 * not just the file name, so a renamed file can't trick us.
 */
export function detectFileType(buffer: Buffer, fileName: string): ResumeFileType | null {
  const name = fileName.toLowerCase();
  const head = buffer.subarray(0, 5).toString('latin1');

  if (head.startsWith('%PDF-')) return 'pdf';
  // .docx files are ZIP archives, which start with "PK\x03\x04"
  if (head.startsWith('PK\x03\x04') && name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') && !buffer.subarray(0, 1024).includes(0)) return 'txt';
  return null;
}

/** Tidies extracted text: consistent line breaks, no runs of blank lines or spaces. */
export function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractResumeText(buffer: Buffer, type: ResumeFileType): Promise<string> {
  let raw: string;

  try {
    if (type === 'pdf') {
      const { text } = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
      raw = text;
    } else if (type === 'docx') {
      const { value } = await mammoth.extractRawText({ buffer });
      raw = value;
    } else {
      raw = buffer.toString('utf8');
    }
  } catch {
    throw new AppError(
      422,
      "We couldn't open this file. Is it a valid PDF or Word document?",
      'CV_UNREADABLE',
    );
  }

  const text = normaliseText(raw);

  if (text.length < MIN_CHARACTERS) {
    throw new AppError(
      422,
      "We couldn't read enough text from this file. If it's a scanned image, export your CV as a text-based PDF or Word file.",
      'CV_UNREADABLE',
    );
  }

  return text.slice(0, MAX_CHARACTERS);
}
