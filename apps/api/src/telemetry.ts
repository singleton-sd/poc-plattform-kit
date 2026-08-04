/**
 * Azure Monitor OpenTelemetry must start before Nest (or any other) imports
 * that create HTTP servers / frameworks. Import this module first from main.ts.
 */
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  useAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString,
    },
  });
}
