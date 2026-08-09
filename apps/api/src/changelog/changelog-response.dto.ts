import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangelogChangeDto {
  @ApiProperty({ example: 'New' })
  type!: string;

  @ApiProperty({ example: 'Add audit history' })
  summary!: string;

  @ApiPropertyOptional({ example: 'So administrators can explain account changes.' })
  reason?: string;
}

export class ChangelogReleaseDto {
  @ApiProperty({ example: '0.22.0' })
  version!: string;

  @ApiProperty({ example: '2026-08-08', format: 'date' })
  date!: string;

  @ApiProperty({ type: [ChangelogChangeDto] })
  changes!: ChangelogChangeDto[];
}

export class ChangelogResponseDto {
  @ApiProperty({ example: '@poc-plattform-kit/api' })
  product!: string;

  @ApiProperty({ type: [ChangelogReleaseDto] })
  releases!: ChangelogReleaseDto[];
}
