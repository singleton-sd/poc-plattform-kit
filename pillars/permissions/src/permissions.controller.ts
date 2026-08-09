import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CheckPermissionResponseDto } from './dto/check-permission-response.dto';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { GrantPermissionResponseDto } from './dto/grant-permission-response.dto';
import { PermissionsHealthResponseDto } from './dto/permissions-health-response.dto';
import { RevokePermissionDto } from './dto/revoke-permission.dto';
import { RevokePermissionResponseDto } from './dto/revoke-permission-response.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('permissions')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check a fine-grained authorization decision',
    description:
      'Evaluates a subject, action, and resource tuple. Fails closed until OpenFGA is configured. One-time grants are revoked after the first successful allow.',
  })
  @ApiOkResponse({ type: CheckPermissionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  check(@Body() request: CheckPermissionDto): Promise<CheckPermissionResponseDto> {
    return this.permissions.check(request);
  }

  @Post('grants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant a permission (permanent, temporary, or one-time)',
    description:
      'Writes an OpenFGA relationship tuple. Temporary grants use condition not_yet_expired. One-time grants are consumed on the next successful Check. Trusted internal callers only — approver AuthZ is enforced by the Access Request workflow.',
  })
  @ApiOkResponse({ type: GrantPermissionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  grant(@Body() request: GrantPermissionDto): Promise<GrantPermissionResponseDto> {
    return this.permissions.grant(request);
  }

  @Post('grants/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a previously granted permission',
    description:
      'Deletes the OpenFGA relationship tuple (and any one-time marker). Trusted internal callers only.',
  })
  @ApiOkResponse({ type: RevokePermissionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  revoke(@Body() request: RevokePermissionDto): Promise<RevokePermissionResponseDto> {
    return this.permissions.revoke(request);
  }

  @Get('health')
  @ApiOperation({ summary: 'Report Permissions pillar health' })
  @ApiOkResponse({ type: PermissionsHealthResponseDto })
  health(): PermissionsHealthResponseDto {
    return { status: 'ok', pillar: 'permissions' };
  }
}
