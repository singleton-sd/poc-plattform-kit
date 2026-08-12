import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTenantInvitationDto {
  @ApiProperty({ example: 'newmember@example.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'member',
    description: 'Role the invitee will receive on their TenantMembership once they accept.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  role!: string;
}
