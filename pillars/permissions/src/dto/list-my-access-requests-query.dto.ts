import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { OPEN_FGA_OBJECT } from '../open-fga-object';

export class ListMyAccessRequestsQueryDto {
  @ApiProperty({ required: false, example: 'update' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  action?: string;

  @ApiProperty({ required: false, example: 'tenant:acme' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  resource?: string;
}
