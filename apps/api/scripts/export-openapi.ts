/**
 * Offline OpenAPI export — no HTTP server listen.
 * Writes packages/api-client/openapi.json for Orval and other generators.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocumentConfig } from '../src/swagger.config';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildOpenApiDocumentConfig());
  await app.close();

  const outPath = join(__dirname, '../../../packages/api-client/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath}`);
}

exportOpenApi().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
