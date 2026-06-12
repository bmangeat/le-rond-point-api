import { IsString, IsOptional, IsDateString, IsBoolean, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsDateString()
  @IsOptional()
  birthday?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  instagram?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  snapchat?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  tiktok?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  linkedin?: string;

  @IsString()
  @IsOptional()
  image?: string;

  // Préférences push
  @IsBoolean()
  @IsOptional()
  notifPush?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPushOverlap?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPushBirthday?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPushPresence?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPushPhotos?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPushEvents?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPushAsResident?: boolean;
}
