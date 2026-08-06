import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponseDto, description: 'Service is healthy.' })
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}
