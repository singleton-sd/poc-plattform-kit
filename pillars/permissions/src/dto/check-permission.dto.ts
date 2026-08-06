import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const OPEN_FGA_OBJECT = /^[^:\s]+:[^\s:][^\s]*$/;

export class CheckPermissionDto {
  @ApiProperty({ example: 'user:alice', description: 'OpenFGA subject identifier.' })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  subject!: string;

  @ApiProperty({ example: 'viewer', description: 'OpenFGA relation or permission.' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({
    example: 'document:quarterly-report',
    description: 'OpenFGA resource identifier.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  resource!: string;
}
