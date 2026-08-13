import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@poc-plattform-kit/db';
import type { AuthenticatedUser } from './map-entra-claims';

export type UserDisplayRecord = {
  id: string;
  email: string;
  name: string | null;
};

@Injectable()
export class UserIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(identity: AuthenticatedUser): Promise<AuthenticatedUser> {
    const email = identity.email.trim();
    if (!email) {
      throw new UnauthorizedException('Entra identity is missing an email address');
    }

    const user = await this.prisma.user.upsert({
      where: { entraOid: identity.entraOid },
      create: { entraOid: identity.entraOid, email, name: identity.name },
      update: { email, name: identity.name },
    });

    return { ...identity, id: user.id, email: user.email, name: user.name };
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
}
