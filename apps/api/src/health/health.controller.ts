import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health-response.dto';
import { Public } from '../single-sign-on/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOkResponse({ type: HealthResponseDto, description: 'Service is healthy.' })
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}
