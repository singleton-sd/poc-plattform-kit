import { apiUrl } from '@/features/auth/api-base-url';

export function AppFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
  const apiDocsHref = apiUrl('/docs');

  return (
    <footer className="px-4 py-6 text-center text-sm text-fg-muted" data-testid="app-footer">
      <nav aria-label="Product" className="mb-3 flex flex-wrap justify-center gap-4">
        <a
          className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/changelog"
        >
          What’s new
        </a>
        <a
          className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="https://plattform-kit.poc.singletonsd.com"
        >
          Marketing
        </a>
        <a
          className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href={apiDocsHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          API
        </a>
        <a
          className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="https://plattform-kit.poc.singletonsd.com/privacy"
        >
          Privacy
        </a>
        <a
          className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="https://plattform-kit.poc.singletonsd.com/terms"
        >
          Terms
        </a>
      </nav>
      <p>
        Platform Kit<span className="text-accent">.</span> <span>v{version}</span>
      </p>
    </footer>
  );
}
