import { ApiProperty } from '@nestjs/swagger';
import { PermissionGrantType } from './grant-permission.dto';

export class GrantPermissionResponseDto {
  @ApiProperty({ example: true })
  granted!: boolean;

  @ApiProperty({ enum: PermissionGrantType, example: PermissionGrantType.Permanent })
  grantType!: PermissionGrantType;
}
