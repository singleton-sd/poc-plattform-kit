import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './cors-origins';
import { configureSingleSignOnAuth } from './single-sign-on/configure-auth';
import { buildOpenApiDocumentConfig } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
  });

  configureSingleSignOnAuth(app.getHttpAdapter().getInstance() as Express);

  const document = SwaggerModule.createDocument(app, buildOpenApiDocumentConfig());
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
