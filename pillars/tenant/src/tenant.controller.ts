import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOAuth2,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from './current-user.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { TenantListResponseDto } from './dto/tenant-list-response.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Roles } from './roles.decorator';
import { TenantService } from './tenant.service';

const DEFAULT_SELF_SERVICE_TENANT_LIMIT = 1;

/** Per-user cap on tenants ownable via the self-service route; see `createSelfService`. */
function selfServiceTenantLimit(): number {
  const raw = process.env.SELF_SERVICE_TENANT_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SELF_SERVICE_TENANT_LIMIT;
}

@ApiTags('tenants')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  @Roles('support-agent')
  @ApiOkResponse({
    type: TenantListResponseDto,
    description: 'A page of tenants matching the optional name or slug search.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({ description: 'Requires the support-agent role.' })
  findAll(@Query() query: ListTenantsQueryDto) {
    return this.tenants.findAll(query);
  }

  /**
   * Admin/support-facing tenant creation -- role-gated, uncapped. This is
   * the path support-agent and tenant-admin callers use to provision a
   * tenant on someone else's behalf (or their own, as an admin). It stays
   * separate from `createSelfService` below on purpose: this route trusts
   * the caller's coarse Entra role and does not enforce a per-user quota,
   * while the self-service route trusts only "is authenticated" and caps
   * usage. Do not merge the two back together -- the role gate and the cap
   * each belong to exactly one of them.
   */
  @Post()
  @Roles('support-agent', 'tenant-admin')
  @ApiCreatedResponse({
    type: TenantResponseDto,
    description: 'Tenant created; the caller is auto-assigned as its owner.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    // AuthenticatedUser.id falls back to the Entra oid until a local User row
    // exists for this session (see mapEntraClaims) -- no call site anywhere
    // in the app passes localUserId today, so this stores that oid, same as
    // every other consumer of AuthenticatedUser.id (e.g. GET /api/me).
    // "Persist SSO User locally on sign-in" (ClickUp 86d3zbugm) is the
    // tracked ticket that starts populating real local User.id values; no
    // membership-specific fix belongs here.
    return this.tenants.create(dto, user.id);
  }

  /**
   * Self-service tenant creation -- open to any authenticated user (no
   * `@Roles(...)` gate; only the global session/JWT `APP_GUARD` applies),
   * capped at `SELF_SERVICE_TENANT_LIMIT` (default 1) owned tenants per
   * user. This is the entry point the onboarding card
   * (`apps/web/src/features/onboarding`) uses so a brand-new signed-in user
   * with no tenant can create one without needing support-agent or
   * tenant-admin first -- see ClickUp 86d3zetkw and the PR #111 discussion
   * on why `create()` above was not simply loosened for this. Delegates to
   * the exact same `TenantService.create` transactional path (entity +
   * audit + outbox + owner membership) as the admin route; this method is
   * only the quota check. Do not merge these two routes back together --
   * see the comment on `create()`.
   */
  @Post('self-service')
  @ApiCreatedResponse({
    type: TenantResponseDto,
    description:
      'Tenant created via self-service; the caller is auto-assigned as its owner. Requires only an authenticated session -- no support-agent/tenant-admin role.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiConflictResponse({
    description:
      'Caller already owns the maximum number of self-service tenants (SELF_SERVICE_TENANT_LIMIT, default 1).',
  })
  async createSelfService(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    const limit = selfServiceTenantLimit();
    const owned = await this.tenants.countOwnedTenants(user.id);
    if (owned >= limit) {
      throw new ConflictException(
        `You already own the maximum of ${limit} self-service tenant${limit === 1 ? '' : 's'}.`,
      );
    }
    return this.tenants.create(dto, user.id);
  }

  @Get(':id')
  @ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description:
      'Legacy/dev tenancy escape when the token has no tenant_id claim. Claim wins when both are present.',
  })
  @ApiOkResponse({
    type: TenantResponseDto,
    description: 'Tenant by id (requires matching tenancy context).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  findOne(@Param('id') id: string) {
    return this.tenants.findOne(id);
  }

  @Patch(':id')
  @Roles('tenant-admin')
  @ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description:
      'Legacy/dev tenancy escape when the token has no tenant_id claim. Claim wins when both are present.',
  })
  @ApiOkResponse({
    type: TenantResponseDto,
    description: 'Tenant updated after AuthN, tenancy, role, and Permissions AuthZ checks.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({
    description: 'Requires tenant-admin role and Permissions tuple user:<id>, update, tenant:<id>.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }
}
