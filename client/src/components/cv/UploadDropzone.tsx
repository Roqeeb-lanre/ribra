import { useRef, useState, type DragEvent } from 'react';
import { Spinner } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const ACCEPTED = ['.pdf', '.docx', '.txt'];
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  onFile: (file: File) => void;
  uploading: boolean;
  onInvalid: (message: string) => void;
};

/** Drag-and-drop (or click) area for choosing a CV file. Checks type and size before uploading. */
export function UploadDropzone({ onFile, uploading, onInvalid }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handle(file: File | undefined) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
      onInvalid('Please choose a PDF, Word (.docx) or text (.txt) file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      onInvalid('That file is too large. The maximum size is 5 MB.');
      return;
    }
    onFile(file);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    handle(event.dataTransfer.files[0]);
  }

  return (
    <button
      type="button"
      disabled={uploading}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
        dragging
          ? 'border-brand-400 bg-brand-500/10'
          : 'border-white/15 bg-surface/50 hover:border-brand-400/60 hover:bg-white/[0.03]',
        uploading && 'cursor-wait opacity-80',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
        {uploading ? (
          <Spinner className="h-5 w-5" />
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <p className="font-medium text-white">
        {uploading ? 'Reading your CV…' : 'Drop your CV here, or click to browse'}
      </p>
      <p className="mt-1 text-sm text-slate-400">PDF, Word (.docx) or .txt · up to 5 MB</p>
    </button>
  );
}
