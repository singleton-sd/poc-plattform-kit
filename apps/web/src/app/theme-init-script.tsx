// Sets [data-theme] on <html> before paint (avoids a light/dark flash).
// Defaults to dark so the admin console matches marketing.
// Not next-themes -- kept dependency-free since this is the only place we
// need it right now.
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export function ThemeInitScript() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />;
}
