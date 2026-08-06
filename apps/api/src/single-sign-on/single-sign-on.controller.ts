import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { toMeResponse, type AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from './current-user.decorator';
import { SessionOrJwtAuthGuard } from './jwt-auth.guard';

@ApiTags('SingleSignOn')
@Controller('api')
export class SingleSignOnController {
  @Get('me')
  @UseGuards(SessionOrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user (cookie session or Bearer JWT)' })
  @ApiResponse({ status: 200, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return toMeResponse(user);
  }
}
