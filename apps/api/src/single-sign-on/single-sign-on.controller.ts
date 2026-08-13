import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { toMeResponse, type AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { TenantService } from '@poc-plattform-kit/pillar-tenant';
import { CurrentUser } from './current-user.decorator';
import { MeResponseDto } from './me-response.dto';

@ApiTags('SingleSignOn')
@Controller('api')
export class SingleSignOnController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOAuth2([])
  @ApiOperation({ summary: 'Current authenticated user (cookie session or Bearer JWT)' })
  @ApiOkResponse({ type: MeResponseDto, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    const memberships = await this.tenantService.listMembershipsForUser(user.id);
    return {
      ...toMeResponse(user),
      memberships: memberships.map(({ tenantId, role }) => ({ tenantId, role })),
    };
  }
}
