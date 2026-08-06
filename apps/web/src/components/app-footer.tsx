export function AppFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

  return (
    <footer className="bg-bg px-4 py-3 text-center text-sm text-fg-muted" data-testid="app-footer">
      <span>v{version}</span>
    </footer>
  );
}
