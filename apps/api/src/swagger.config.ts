import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder } from '@nestjs/swagger';

function readPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Shared DocumentBuilder config for runtime Swagger UI and offline OpenAPI export. */
export function buildOpenApiDocumentConfig() {
  return new DocumentBuilder()
    .setTitle('Platform Kit API')
    .setDescription('poc-plattform-kit API')
    .setVersion(readPackageVersion())
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id')
    .build();
}
