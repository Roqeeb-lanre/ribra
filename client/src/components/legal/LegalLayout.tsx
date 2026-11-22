import { Link } from 'react-router';
import { Logo } from '@/components/ui/Logo';

type LegalLayoutProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

/** Simple reading layout for the Privacy Policy and Terms pages. */
export function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <div className="relative min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex gap-4 text-sm text-slate-400">
          <Link to="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-white">
            Terms
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
        <div className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-slate-300">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-brand-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export const CONTACT_EMAIL = 'roqeebojetola75@gmail.com';

export function ContactLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-300 hover:text-brand-200">
      {CONTACT_EMAIL}
    </a>
  );
}
