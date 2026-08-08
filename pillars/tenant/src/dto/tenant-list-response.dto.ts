import { ApiProperty } from '@nestjs/swagger';
import { TenantResponseDto } from './tenant-response.dto';

export class TenantListResponseDto {
  @ApiProperty({ type: TenantResponseDto, isArray: true })
  items!: TenantResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Cursor to pass as `cursor` to fetch the next page, or null when this is the last page.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  nextCursor!: string | null;
}
