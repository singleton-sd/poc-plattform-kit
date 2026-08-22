import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../single-sign-on/public.decorator';
import { BIMI_LOGO_SVG } from '@poc-plattform-kit/email';

@ApiTags('bimi')
@Controller('bimi')
export class BimiLogoController {
  @Get('logo.svg')
  @Public()
  @ApiOperation({ summary: 'Serve the public BIMI SVG logo' })
  @ApiOkResponse({
    description: 'Returns the BIMI SVG logo.',
    content: {
      'image/svg+xml': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  logo(@Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    // BIMI receivers fetch the indicator over HTTPS; keep it static and public.
    res.send(BIMI_LOGO_SVG);
  }
}
