import changelog from '@/content/changelog.json';

export const metadata = {
  title: 'What’s new | Platform Kit',
  description: 'Recent improvements and fixes in the Platform Kit app.',
};

export default function ChangelogPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <a className="text-sm text-accent hover:underline" href="/">
        ← Back to the app
      </a>
      <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        Product updates
      </p>
      <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight">What’s new</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-muted">
        The latest app improvements, generated from the commits that created each release.
      </p>

      <div className="mt-12 space-y-12">
        {changelog.releases.map((release) => (
          <article key={release.version} className="border-l-2 border-accent pl-6">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-heading text-2xl font-semibold">Version {release.version}</h2>
              <time className="text-sm text-fg-muted" dateTime={release.date}>
                {new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(
                  new Date(`${release.date}T00:00:00Z`),
                )}
              </time>
            </header>
            <ul className="mt-5 space-y-5">
              {release.changes.map((change) => (
                <li key={`${change.type}-${change.summary}`}>
                  <p>
                    <span className="mr-2 rounded bg-accent-bg px-2 py-1 text-xs font-semibold text-accent">
                      {change.type}
                    </span>
                    <span className="font-medium">{change.summary}</span>
                  </p>
                  {'reason' in change ? (
                    <p className="mt-2 leading-relaxed text-fg-muted">{change.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
