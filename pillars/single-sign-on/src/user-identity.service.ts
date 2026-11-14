import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@poc-plattform-kit/db';
import type { AuthenticatedUser } from './map-keycloak-claims';

export type UserDisplayRecord = {
  id: string;
  email: string;
  name: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  entraOid: string | null;
  keycloakSub: string | null;
};

@Injectable()
export class UserIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert the local User for a Keycloak identity.
   *
   * 1. Match on `keycloakSub`.
   * 2. Else, when email is verified, backfill `keycloakSub` onto the existing
   *    unique email row (Entra leftover).
   * 3. Else create a new user (`entraOid` stays null).
   */
  async persist(identity: AuthenticatedUser): Promise<AuthenticatedUser> {
    const email = identity.email.trim();
    if (!email) {
      throw new UnauthorizedException('Keycloak identity is missing an email address');
    }
    if (!identity.keycloakSub) {
      throw new UnauthorizedException('Keycloak identity is missing a subject');
    }

    const bySub = await this.prisma.user.findUnique({
      where: { keycloakSub: identity.keycloakSub },
    });
    if (bySub) {
      return this.refresh(identity, bySub, email);
    }

    if (identity.emailVerified) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        const linked = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            keycloakSub: identity.keycloakSub,
            name: identity.name,
          },
        });
        return this.toAuthenticated(identity, linked);
      }
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          keycloakSub: identity.keycloakSub,
          email,
          name: identity.name,
          entraOid: identity.entraOid,
        },
      });
      return this.toAuthenticated(identity, created);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const raced = await this.prisma.user.findUnique({
          where: { keycloakSub: identity.keycloakSub },
        });
        if (raced) {
          return this.refresh(identity, raced, email);
        }
      }
      throw error;
    }
  }

  /** SSO-owned read contract for resolving durable local user display data. */
  async findDisplayRecords(userIds: string[]): Promise<UserDisplayRecord[]> {
    const ids = [...new Set(userIds)].sort();
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, name: true },
      orderBy: { id: 'asc' },
    });
  }

  private async refresh(
    identity: AuthenticatedUser,
    row: UserRow,
    email: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: row.id },
      data: { email, name: identity.name },
    });
    return this.toAuthenticated(identity, user);
  }

  private toAuthenticated(identity: AuthenticatedUser, user: UserRow): AuthenticatedUser {
    return {
      ...identity,
      id: user.id,
      email: user.email,
      name: user.name,
      entraOid: user.entraOid,
      keycloakSub: user.keycloakSub ?? identity.keycloakSub,
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
