import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const OPEN_FGA_OBJECT = /^[^:\s]+:[^\s:][^\s]*$/;

export class RevokePermissionDto {
  @ApiProperty({ example: 'user:alice', description: 'OpenFGA subject identifier.' })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  subject!: string;

  @ApiProperty({ example: 'update', description: 'OpenFGA relation or permission.' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({
    example: 'tenant:acme',
    description: 'OpenFGA resource identifier.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  resource!: string;
}
