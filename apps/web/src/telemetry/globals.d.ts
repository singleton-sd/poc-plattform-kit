/// <reference lib="dom" />

export {};

declare global {
  interface Window {
    __APP_INSIGHTS_CONNECTION_STRING__?: string;
    appInsights?: {
      trackException: (payload: { exception: Error }) => void;
      trackTrace?: (payload: {
        message: string;
        severityLevel?: number;
      }) => void;
      trackPageView?: () => void;
    };
    Microsoft?: {
      ApplicationInsights?: {
        ApplicationInsights: new (options: {
          config: Record<string, unknown>;
        }) => {
          loadAppInsights: () => void;
          addTelemetryInitializer: (
            fn: (envelope: { tags?: Record<string, string> }) => boolean,
          ) => void;
          trackPageView: () => void;
          trackException: (payload: { exception: Error }) => void;
        };
      };
    };
  }
}
