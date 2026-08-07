/**
 * Decap / Netlify CMS OAuth handshake HTML (postMessage to opener).
 * @see https://github.com/vencax/netlify-cms-github-oauth-provider
 */

export type OauthResultMessage = 'success' | 'error';

export function parseOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    throw new Error('ORIGINS must be a comma-separated list of allowed hostnames');
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function buildLoginScript(
  oauthProvider: string,
  message: OauthResultMessage,
  content: Record<string, unknown> | string,
  origins: string[],
): string {
  const contentJson = typeof content === 'string' ? content : JSON.stringify(content);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Decap OAuth</title></head>
<body>
<script>
(function () {
  var origins = ${JSON.stringify(origins)};
  function contains(arr, elem) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].indexOf('*') >= 0) {
        var regex = new RegExp('^' + arr[i].replace(/\\./g, '\\\\.').replace(/\\*/g, '[\\\\w_-]+') + '$');
        if (elem.match(regex) !== null) return true;
      } else if (arr[i] === elem) {
        return true;
      }
    }
    return false;
  }
  function receiveMessage(e) {
    var host = e.origin.replace('https://', '').replace('http://', '');
    if (!contains(origins, host)) {
      console.log('Invalid origin:', e.origin);
      return;
    }
    window.opener.postMessage(
      'authorization:${oauthProvider}:${message}:${contentJson}',
      e.origin
    );
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:${oauthProvider}', '*');
})();
</script>
<p>Completing GitHub login…</p>
</body>
</html>`;
}
