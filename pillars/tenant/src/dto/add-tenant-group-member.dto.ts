import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddTenantGroupMemberDto {
  @ApiProperty({ description: 'Durable local user id to add to the group.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  userId!: string;
}
