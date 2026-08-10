import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListMyAccessRequestsQueryDto {
  @ApiProperty({ required: false, example: 'update' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ required: false, example: 'tenant:acme' })
  @IsOptional()
  @IsString()
  resource?: string;
}
