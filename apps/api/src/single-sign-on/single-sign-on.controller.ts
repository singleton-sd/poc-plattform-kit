import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOAuth2, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { toMeResponse, type AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from './current-user.decorator';

@ApiTags('SingleSignOn')
@Controller('api')
export class SingleSignOnController {
  @Get('me')
  @ApiBearerAuth()
  @ApiOAuth2([])
  @ApiOperation({ summary: 'Current authenticated user (cookie session or Bearer JWT)' })
  @ApiResponse({ status: 200, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return toMeResponse(user);
  }
}
