import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bootstrap = readFileSync(join(process.cwd(), 'public/telemetry.js'), 'utf8');

describe('browser telemetry bootstrap', () => {
  const loadAppInsights = jest.fn();
  const addTelemetryInitializer = jest.fn();
  const trackPageView = jest.fn();
  const trackException = jest.fn();

  beforeEach(() => {
    document.head.innerHTML = '';
    delete window.__APP_INSIGHTS_CONNECTION_STRING__;
    delete window.appInsights;
    delete window.Microsoft;
    loadAppInsights.mockReset();
    addTelemetryInitializer.mockReset();
    trackPageView.mockReset();
    trackException.mockReset();
  });

  it('does not load the SDK without a connection string', () => {
    window.eval(bootstrap);

    expect(document.head.querySelector('script')).toBeNull();
  });

  it('loads and initializes the SDK from window configuration', () => {
    window.__APP_INSIGHTS_CONNECTION_STRING__ = 'InstrumentationKey=test-key';
    installSdkMock();

    window.eval(bootstrap);
    loadSdkScript();

    expect(document.head.querySelector('script')?.src).toBe(
      'https://js.monitor.azure.com/scripts/b/ai.3.gbl.min.js',
    );
    expect(loadAppInsights).toHaveBeenCalledTimes(1);
    expect(trackPageView).toHaveBeenCalledTimes(1);
    expect(window.appInsights).toBeDefined();
  });

  it('reads configuration from metadata and assigns the web cloud role', () => {
    document.head.innerHTML =
      '<meta name="applicationinsights-connection-string" content="InstrumentationKey=meta-key">';
    installSdkMock();

    window.eval(bootstrap);
    loadSdkScript();

    const initializer = addTelemetryInitializer.mock.calls[0]?.[0] as (envelope: {
      tags?: Record<string, string>;
    }) => boolean;
    const envelope: { tags?: Record<string, string> } = {};
    expect(initializer(envelope)).toBe(true);
    expect(envelope.tags?.['ai.cloud.role']).toBe('web');
  });

  it('reports unhandled browser errors', () => {
    window.__APP_INSIGHTS_CONNECTION_STRING__ = 'InstrumentationKey=test-key';
    installSdkMock();
    window.eval(bootstrap);
    loadSdkScript();
    const error = new Error('unhandled');

    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));

    expect(trackException).toHaveBeenCalledWith({ exception: error });
  });

  function installSdkMock(): void {
    window.Microsoft = {
      ApplicationInsights: {
        ApplicationInsights: class {
          loadAppInsights = loadAppInsights;
          addTelemetryInitializer = addTelemetryInitializer;
          trackPageView = trackPageView;
          trackException = trackException;
        },
      },
    };
  }

  function loadSdkScript(): void {
    const script = document.head.querySelector('script');
    expect(script).not.toBeNull();
    script?.dispatchEvent(new Event('load'));
  }
});
