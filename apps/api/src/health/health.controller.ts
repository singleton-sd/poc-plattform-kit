import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@poc-plattform-kit/db';
import { HealthResponseDto } from './health-response.dto';
import { Public } from '../single-sign-on/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: HealthResponseDto, description: 'Service is healthy.' })
  check(): HealthResponseDto {
    return { status: 'ok' };
  }

  /**
   * Additive readiness signal, separate from the plain liveness check above
   * so existing `/health` consumers see no behaviour change. Used by the
   * API PR preview workflow to wait until the container's copied SQLite
   * database is actually queryable (not just that the process is up) —
   * see .github/workflows/preview-api.yml and docs/pr-pipelines.md.
   */
  @Get('db')
  @Public()
  @ApiOkResponse({ type: HealthResponseDto, description: 'The database is queryable.' })
  async checkDatabase(): Promise<HealthResponseDto> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
