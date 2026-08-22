import { Module } from '@nestjs/common';
import { BimiLogoController } from './bimi-logo.controller';

@Module({
  controllers: [BimiLogoController],
})
export class BimiModule {}
