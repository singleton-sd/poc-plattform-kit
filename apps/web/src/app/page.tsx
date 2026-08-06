import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-fg">
      <h1 className="font-heading text-2xl font-semibold">Platform Kit</h1>
      <p className="text-fg-muted">poc-plattform-kit web shell.</p>
      <Link className="text-sm text-accent underline" href="/tenants">
        Tenants
      </Link>
    </main>
  );
}
