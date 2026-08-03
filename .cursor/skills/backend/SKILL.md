---
name: Backend
description: Opinionated NestJS + SQL Server + Prisma backend guidelines for Singleton SD personal projects. Extends nodejs-backend-patterns with NestJS-specific module structure, Prisma conventions, DTO validation, and JWT auth patterns.
tags: [engineering, backend, nestjs, sqlserver, prisma, typescript, rest-api]
audience: [engineers]
status: stable
---

# Backend

> First, apply all rules from the **nodejs-backend-patterns** skill. The rules below extend and override that baseline for Singleton SD personal projects.
>
> When the backend is paired with a Next.js frontend, also apply **next-best-practices** for route handler and BFF patterns on the frontend side.

---

## Stack Decision

| Scenario | Choice |
|---|---|
| Complex domain, multiple consumers, long-lived API | **NestJS** |
| Simple CRUD, single Next.js frontend, fast iteration | **Next.js Route Handlers** as BFF |
| Need background jobs, queues, or WebSockets | **NestJS** |

Default to **NestJS** for any project that will outlive a prototype.

---

## Canonical Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | NestJS | Opinionated structure, DI, decorators |
| Language | TypeScript strict | Always |
| Database | SQL Server | Primary relational store; strong tooling, T-SQL, enterprise-ready |
| ORM | Prisma | Type-safe, great DX, auto-generated client |
| Validation | class-validator + class-transformer | Native NestJS ValidationPipe integration |
| Auth | @nestjs/jwt + @nestjs/passport | Standard NestJS auth ecosystem |
| Config | @nestjs/config | Typed env vars with Joi schema validation |
| Logging | Pino via nestjs-pino | Structured JSON logs |

---

## Project Setup

```bash
npm i -g @nestjs/cli
nest new my-api --strict
cd my-api

# Core deps
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm install class-validator class-transformer
npm install nestjs-pino pino-http pino-pretty

# Prisma
npm install prisma @prisma/client
npx prisma init --datasource-provider sqlserver

# Dev deps
npm install -D @types/passport-jwt
```

Enable global pipes and Pino in `main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,       // auto-transform payloads to DTO instances
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## File Structure

```
src/
  app.module.ts             # Root module — imports all feature modules
  main.ts
  common/
    decorators/             # Custom decorators (@CurrentUser, etc.)
    filters/                # Exception filters
    guards/                 # JwtAuthGuard, RolesGuard
    interceptors/           # Logging, transform response
    pipes/                  # Custom pipes
  config/
    app.config.ts           # Typed config with validation schema
  prisma/
    prisma.module.ts
    prisma.service.ts
  features/
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
      dto/
        create-user.dto.ts
        update-user.dto.ts
```

One NestJS module per domain feature. No barrel files — import directly.

---

## Prisma Conventions

### PrismaService

```ts
// prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

```ts
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Mark `PrismaModule` as `@Global()` — import it once in `AppModule`, available everywhere.

### Schema conventions

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

Example `DATABASE_URL`:

```
sqlserver://localhost:1433;database=my_api;user=sa;password=Your_password123;encrypt=true;trustServerCertificate=true
```

- Use `cuid()` for IDs, not auto-increment integers — safe for distributed use
- Always add `createdAt` / `updatedAt`
- Use `@@map` to keep table names snake_case
- Never expose the `password` field — select it out explicitly in the service

### Migrations

```bash
# Create and apply a migration
npx prisma migrate dev --name add-users-table

# Apply in CI/production (no prompt)
npx prisma migrate deploy
```

---

## DTO Validation

```ts
// features/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Rules:
- Every controller method that accepts a body gets a DTO
- `whitelist: true` in ValidationPipe means no extra properties leak through
- Use `PartialType(CreateUserDto)` from `@nestjs/mapped-types` for update DTOs — never repeat fields

---

## Module Pattern

```ts
// features/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // export only if other modules need it
})
export class UsersModule {}
```

```ts
// features/users/users.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

```ts
// features/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: { ...dto, password: hashed },
    });

    const { password, ...result } = user;
    return result;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, ...result } = user;
    return result;
  }
}
```

---

## JWT Auth

```ts
// common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```ts
// features/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { id: payload.sub, email: payload.email };
  }
}
```

Access the current user in controllers via a custom decorator:

```ts
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

---

## Config

```ts
// config/app.config.ts
import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
}));

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
```

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { validationSchema } from './config/app.config';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    LoggerModule.forRoot(),
    PrismaModule,
    UsersModule,
  ],
})
export class AppModule {}
```

---

## Rules

- Never use `any` — use Prisma-generated types or explicit interfaces
- Never return raw Prisma model objects that include `password` or other sensitive fields — destructure them out in the service
- Use NestJS built-in HTTP exceptions (`NotFoundException`, `ConflictException`, etc.) — never throw raw `Error`
- Services own business logic and Prisma queries — controllers only handle HTTP concerns
- One module per feature domain — keep `AppModule` as a thin orchestrator
- Validate all env vars at startup via `@nestjs/config` + Joi — fail fast rather than at runtime
