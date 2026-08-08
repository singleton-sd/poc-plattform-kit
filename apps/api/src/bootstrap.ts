import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { Logger, PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { resolveCorsOrigin } from './cors-origins';
import { configureSingleSignOnAuth } from './single-sign-on/configure-auth';
import { buildOpenApiDocumentConfig } from './swagger.config';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  // App Service and ACA put one trusted reverse proxy in front of the API.
  // This lets throttling identify clients from the forwarded address.
  expressApp.set('trust proxy', 1);
  app.useLogger(app.get(Logger));
  // Swagger UI needs inline assets, so leave CSP to the serving edge until a
  // route-specific policy is introduced. All other Helmet defaults stay on.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(correlationIdMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter(await app.resolve(PinoLogger)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Option B SSO: SPA on app.* calls api.* with credentials (shared cookie domain).
  // Also allow this-repo SWA Free / PR preview hosts via instance-scoped
  // https://{swaName}*.azurestaticapps.net entries in CORS_ORIGINS.
  app.enableCors({
    origin: (origin, callback) => resolveCorsOrigin(origin, callback),
    // Required for browser credentialed fetches (api-client defaults to credentials: 'include').
    credentials: true,
  });

  configureSingleSignOnAuth(expressApp);

  const document = SwaggerModule.createDocument(app, buildOpenApiDocumentConfig());
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
