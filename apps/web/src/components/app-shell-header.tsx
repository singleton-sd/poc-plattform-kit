import Link from 'next/link';
import { BrandMark } from './brand-mark';

/** Compact product chrome for authenticated admin surfaces. */
export function AppShellHeader() {
  return (
    <header
      className="flex items-center justify-between gap-4 border-b border-fg-subtle/30 px-6 py-4"
      data-testid="app-shell-header"
    >
      <Link
        href="/"
        className="no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <BrandMark size="header" />
      </Link>
      <nav aria-label="App" className="flex flex-wrap items-center gap-4 text-sm">
        <Link className="text-fg-muted hover:text-accent" href="/tenants">
          Tenants
        </Link>
        <Link className="text-fg-muted hover:text-accent" href="/support">
          Support
        </Link>
      </nav>
    </header>
  );
}
