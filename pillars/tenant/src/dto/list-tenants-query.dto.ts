import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListTenantsQueryDto {
  @ApiPropertyOptional({
    description: 'Substring to match against the tenant name or slug.',
    maxLength: 100,
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description: 'Maximum tenants returned per page.',
    default: 25,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Opaque pagination cursor from a previous response’s nextCursor. Omit to fetch the first page.',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cursor?: string;
}
