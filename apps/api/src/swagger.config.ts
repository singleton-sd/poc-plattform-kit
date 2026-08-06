import { DocumentBuilder } from '@nestjs/swagger';

/** Shared DocumentBuilder config for runtime Swagger UI and offline OpenAPI export. */
export function buildOpenApiDocumentConfig() {
  return new DocumentBuilder()
    .setTitle('Platform Kit API')
    .setDescription('poc-plattform-kit API')
    .setVersion('0.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id')
    .build();
}
