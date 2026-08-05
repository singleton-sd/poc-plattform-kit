/**
 * Browser telemetry bootstrap for the SWA stub (and future Next.js client).
 * Loads Application Insights when a connection string is present.
 *
 * Config sources (first wins):
 * - window.__APP_INSIGHTS_CONNECTION_STRING__
 * - meta[name="applicationinsights-connection-string"] content
 * - ?ai= query param (local demos only; do not use in production URLs)
 */
(function initWebTelemetry() {
  function readConnectionString() {
    if (typeof window !== 'undefined' && window.__APP_INSIGHTS_CONNECTION_STRING__) {
      return String(window.__APP_INSIGHTS_CONNECTION_STRING__).trim();
    }
    var meta = document.querySelector('meta[name="applicationinsights-connection-string"]');
    if (meta && meta.getAttribute('content')) {
      return String(meta.getAttribute('content')).trim();
    }
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = params.get('ai');
      if (fromQuery) return fromQuery.trim();
    } catch (_) {
      /* ignore */
    }
    return '';
  }

  var connectionString = readConnectionString();
  if (!connectionString) {
    return;
  }

  var script = document.createElement('script');
  script.src = 'https://js.monitor.azure.com/scripts/b/ai.3.gbl.min.js';
  script.async = true;
  script.onload = function () {
    try {
      var SDK = window.Microsoft && window.Microsoft.ApplicationInsights;
      if (!SDK || !SDK.ApplicationInsights) {
        console.warn('[telemetry] Application Insights SDK missing after load');
        return;
      }
      var appInsights = new SDK.ApplicationInsights({
        config: {
          connectionString: connectionString,
          enableAutoRouteTracking: true,
          disableFetchTracking: false,
          enableCorsCorrelation: true,
          enableRequestHeaderTracking: true,
          enableResponseHeaderTracking: true,
          correlationHeaderExcludedDomains: [],
        },
      });
      appInsights.loadAppInsights();
      appInsights.addTelemetryInitializer(function (envelope) {
        envelope.tags = envelope.tags || {};
        envelope.tags['ai.cloud.role'] = 'web';
        return true;
      });
      appInsights.trackPageView();
      window.appInsights = appInsights;

      window.addEventListener('error', function (event) {
        appInsights.trackException({
          exception: event.error || new Error(event.message),
        });
      });
      window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        appInsights.trackException({
          exception: reason instanceof Error ? reason : new Error(String(reason)),
        });
      });
    } catch (err) {
      console.warn('[telemetry] failed to initialize Application Insights', err);
    }
  };
  document.head.appendChild(script);
})();
