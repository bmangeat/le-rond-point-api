import { IsString, IsNotEmpty, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}

export class UpdateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}

export class UpdateMembershipDto {
  @IsBoolean()
  @IsOptional()
  isResident?: boolean;
}

export class UpdateMemberRoleDto {
  @IsString()
  @IsNotEmpty()
  role: 'ADMIN' | 'MEMBER';
}
