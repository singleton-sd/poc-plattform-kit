import { ApiProperty } from '@nestjs/swagger';

export class PermissionsHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'permissions' })
  pillar!: 'permissions';
}
