import { ApiProperty } from '@nestjs/swagger';

export class CheckPermissionResponseDto {
  @ApiProperty({
    example: false,
    description: 'Whether the subject may perform the action on the resource.',
  })
  allowed!: boolean;
}
