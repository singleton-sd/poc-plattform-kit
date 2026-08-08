/**
 * Swagger UI oauth2-redirect.html replacement.
 *
 * Entra (and other IdPs) navigate the popup cross-origin, which severs or
 * cross-origin-blocks `window.opener`. The stock swagger-ui redirect then
 * throws SecurityError / null opener and never returns the auth code.
 *
 * Strategy: try opener (same-origin happy path), else BroadcastChannel +
 * localStorage/sessionStorage for the main /docs tab. Same-window Authorize
 * cannot recover Swagger's in-memory oauth state — show guidance instead.
 */
export const SWAGGER_OAUTH2_CHANNEL = 'swagger-ui-oauth2-redirect';
export const SWAGGER_OAUTH2_STORAGE_KEY = 'swagger_ui_oauth2_redirect';

export function buildSwaggerOauth2RedirectHtml(): string {
  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8" />
  <title>Swagger UI: OAuth2 Redirect</title>
</head>
<body>
<script>
(function () {
  var CHANNEL = ${JSON.stringify(SWAGGER_OAUTH2_CHANNEL)};
  var STORAGE_KEY = ${JSON.stringify(SWAGGER_OAUTH2_STORAGE_KEY)};
  var payload = { search: location.search || '', hash: location.hash || '' };

  function completeViaOpener() {
    try {
      var oauth2 = window.opener && window.opener.swaggerUIRedirectOauth2;
      if (!oauth2) {
        return false;
      }
      runWithOauth2(oauth2, payload);
      return true;
    } catch (err) {
      return false;
    }
  }

  function runWithOauth2(oauth2, source) {
    var sentState = oauth2.state;
    var redirectUrl = oauth2.redirectUrl;
    var qp;
    if (/code|token|error/.test(source.hash)) {
      qp = source.hash.substring(1).replace('?', '&');
    } else {
      qp = (source.search || '').substring(1);
    }
    var arr = qp.split('&');
    arr.forEach(function (v, i, a) {
      a[i] = '"' + v.replace('=', '":"') + '"';
    });
    qp = qp
      ? JSON.parse('{' + arr.join() + '}', function (key, value) {
          return key === '' ? value : decodeURIComponent(value);
        })
      : {};
    var isValid = qp.state === sentState;
    if (
      (oauth2.auth.schema.get('flow') === 'accessCode' ||
        oauth2.auth.schema.get('flow') === 'authorizationCode' ||
        oauth2.auth.schema.get('flow') === 'authorization_code') &&
      !oauth2.auth.code
    ) {
      if (!isValid) {
        oauth2.errCb({
          authId: oauth2.auth.name,
          source: 'auth',
          level: 'warning',
          message:
            "Authorization may be unsafe, passed state was changed in server. The passed state wasn't returned from auth server.",
        });
      }
      if (qp.code) {
        delete oauth2.state;
        oauth2.auth.code = qp.code;
        oauth2.callback({ auth: oauth2.auth, redirectUrl: redirectUrl });
      } else {
        var oauthErrorMsg;
        if (qp.error) {
          oauthErrorMsg =
            '[' +
            qp.error +
            ']: ' +
            (qp.error_description ? qp.error_description + '. ' : 'no accessCode received from the server. ') +
            (qp.error_uri ? 'More info: ' + qp.error_uri : '');
        }
        oauth2.errCb({
          authId: oauth2.auth.name,
          source: 'auth',
          level: 'error',
          message: oauthErrorMsg || '[Authorization failed]: no accessCode received from the server.',
        });
      }
    } else {
      oauth2.callback({ auth: oauth2.auth, token: qp, isValid: isValid, redirectUrl: redirectUrl });
    }
  }

  function broadcastFallback() {
    try {
      var channel = new BroadcastChannel(CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch (err) {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {}
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {}
  }

  var hasOpener = false;
  try {
    hasOpener = !!(window.opener && !window.opener.closed);
  } catch (err) {
    hasOpener = false;
  }

  if (completeViaOpener()) {
    try {
      window.close();
    } catch (err) {}
    document.body.textContent = 'Authentication complete. You can close this window.';
    return;
  }

  broadcastFallback();

  if (!hasOpener) {
    // Same-window Authorize destroyed Swagger's in-memory oauth callback.
    document.body.innerHTML =
      '<main style="font:16px/1.4 system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem">' +
      '<h1>Swagger Authorize needs a popup</h1>' +
      '<p>Entra signed you in, but this tab replaced Swagger UI, so the access token could not be returned.</p>' +
      '<p><a href="/docs">Back to Swagger</a>, click <strong>Authorize</strong> again, and <strong>allow popups</strong> for this site so login stays in a separate window.</p>' +
      '</main>';
    return;
  }

  try {
    window.close();
  } catch (err) {}
  document.body.textContent =
    'Authentication complete. If this window did not close, return to the Swagger /docs tab.';
})();
</script>
</body>
</html>`;
}

/**
 * Inline script for Swagger UI (`customJsStr`) — completes OAuth when the
 * redirect popup cannot touch window.opener (Entra COOP / cross-origin).
 */
export function buildSwaggerOauth2BridgeScript(): string {
  return `(function () {
  var CHANNEL = ${JSON.stringify(SWAGGER_OAUTH2_CHANNEL)};
  var STORAGE_KEY = ${JSON.stringify(SWAGGER_OAUTH2_STORAGE_KEY)};
  var handled = false;

  function parseQuery(source) {
    var qp;
    if (/code|token|error/.test(source.hash || '')) {
      qp = source.hash.substring(1).replace('?', '&');
    } else {
      qp = (source.search || '').substring(1);
    }
    var arr = qp.split('&');
    arr.forEach(function (v, i, a) {
      a[i] = '"' + v.replace('=', '":"') + '"';
    });
    return qp
      ? JSON.parse('{' + arr.join() + '}', function (key, value) {
          return key === '' ? value : decodeURIComponent(value);
        })
      : {};
  }

  function complete(source) {
    if (handled) {
      return;
    }
    var oauth2 = window.swaggerUIRedirectOauth2;
    if (!oauth2) {
      return;
    }
    handled = true;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {}
    var qp = parseQuery(source);
    var sentState = oauth2.state;
    var redirectUrl = oauth2.redirectUrl;
    var isValid = qp.state === sentState;
    if (
      (oauth2.auth.schema.get('flow') === 'accessCode' ||
        oauth2.auth.schema.get('flow') === 'authorizationCode' ||
        oauth2.auth.schema.get('flow') === 'authorization_code') &&
      !oauth2.auth.code
    ) {
      if (!isValid) {
        oauth2.errCb({
          authId: oauth2.auth.name,
          source: 'auth',
          level: 'warning',
          message:
            "Authorization may be unsafe, passed state was changed in server. The passed state wasn't returned from auth server.",
        });
      }
      if (qp.code) {
        delete oauth2.state;
        oauth2.auth.code = qp.code;
        oauth2.callback({ auth: oauth2.auth, redirectUrl: redirectUrl });
      } else {
        var oauthErrorMsg;
        if (qp.error) {
          oauthErrorMsg =
            '[' +
            qp.error +
            ']: ' +
            (qp.error_description ? qp.error_description + '. ' : 'no accessCode received from the server. ') +
            (qp.error_uri ? 'More info: ' + qp.error_uri : '');
        }
        oauth2.errCb({
          authId: oauth2.auth.name,
          source: 'auth',
          level: 'error',
          message: oauthErrorMsg || '[Authorization failed]: no accessCode received from the server.',
        });
      }
    } else {
      oauth2.callback({ auth: oauth2.auth, token: qp, isValid: isValid, redirectUrl: redirectUrl });
    }
  }

  try {
    var channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = function (event) {
      if (event && event.data) {
        complete(event.data);
      }
    };
  } catch (err) {}

  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        complete(JSON.parse(event.newValue));
      } catch (err) {}
    }
  });

  try {
    var existing =
      sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (existing) {
      complete(JSON.parse(existing));
    }
  } catch (err) {}
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
})();`;
}
