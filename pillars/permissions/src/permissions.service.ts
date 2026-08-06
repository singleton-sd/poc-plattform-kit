import { Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { CheckPermissionResponseDto } from './dto/check-permission-response.dto';

@Injectable()
export class PermissionsService {
  async check(_request: CheckPermissionDto): Promise<CheckPermissionResponseDto> {
    // Fail closed until the OpenFGA adapter is configured for this environment.
    return { allowed: false };
  }
}
