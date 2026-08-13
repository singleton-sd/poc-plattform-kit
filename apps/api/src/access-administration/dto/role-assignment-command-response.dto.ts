import { ApiProperty } from '@nestjs/swagger';

export class RoleAssignmentCommandResponseDto {
  @ApiProperty({ description: 'Opaque tenant role-assignment revision.' })
  consistencyVersion!: string;

  @ApiProperty({ description: 'Whether this logical command changed desired state.' })
  changed!: boolean;

  @ApiProperty({ description: 'The resulting desired assignment state.' })
  assigned!: boolean;
}
