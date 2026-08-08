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
import { CurrentUser } from './current-user.decorator';
import { MeResponseDto } from './me-response.dto';

@ApiTags('SingleSignOn')
@Controller('api')
export class SingleSignOnController {
  @Get('me')
  @ApiBearerAuth()
  @ApiOAuth2([])
  @ApiOperation({ summary: 'Current authenticated user (cookie session or Bearer JWT)' })
  @ApiOkResponse({ type: MeResponseDto, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@CurrentUser() user: AuthenticatedUser): MeResponseDto {
    return toMeResponse(user);
  }
}
