import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import changelog = require('./changelog.json');
import { ChangelogResponseDto } from './changelog-response.dto';

@ApiTags('Changelog')
@Controller('changelog')
export class ChangelogController {
  @Get()
  @ApiOperation({ summary: 'List recent client-facing API changes' })
  @ApiOkResponse({
    description: 'The 20 most recent API releases and their changes.',
    type: ChangelogResponseDto,
  })
  getChangelog(): ChangelogResponseDto {
    return changelog;
  }
}
