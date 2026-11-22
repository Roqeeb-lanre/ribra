import { Link } from 'react-router';

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Ribra home">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="font-display text-xl font-bold tracking-tight text-white">Ribra</span>
    </Link>
  );
}
