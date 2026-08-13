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
import { PermissionsHealthResponseDto } from './dto/permissions-health-response.dto';
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

  @Get('health')
  @ApiOperation({ summary: 'Report Permissions pillar health' })
  @ApiOkResponse({ type: PermissionsHealthResponseDto })
  health(): PermissionsHealthResponseDto {
    return { status: 'ok', pillar: 'permissions' };
  }
}
