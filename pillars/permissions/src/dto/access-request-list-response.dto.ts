import { ApiProperty } from '@nestjs/swagger';
import { AccessRequestResponseDto } from './access-request-response.dto';

export class AccessRequestListResponseDto {
  @ApiProperty({ type: [AccessRequestResponseDto] })
  items!: AccessRequestResponseDto[];
}
