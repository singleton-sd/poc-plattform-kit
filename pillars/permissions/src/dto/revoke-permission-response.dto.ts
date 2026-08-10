import { ApiProperty } from '@nestjs/swagger';

export class RevokePermissionResponseDto {
  @ApiProperty({ example: true })
  revoked!: boolean;
}
