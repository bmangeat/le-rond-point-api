import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsUrl,
  MaxLength,
  IsNumber,
  IsArray,
} from 'class-validator';
import { EventType, RsvpStatus } from '@prisma/client';

export class CreateEventDto {
  @IsEnum(EventType)
  type: EventType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  whenAt: string;

  @IsString()
  @IsNotEmpty()
  placeName: string;

  @IsString()
  @IsOptional()
  placeAddr?: string;

  @IsBoolean()
  @IsOptional()
  needsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  tricountEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPlaylist?: boolean;

  @IsUrl()
  @IsOptional()
  playlistUrl?: string;
}

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  @IsOptional()
  whenAt?: string;

  @IsString()
  @IsOptional()
  placeName?: string;

  @IsString()
  @IsOptional()
  placeAddr?: string;

  @IsBoolean()
  @IsOptional()
  needsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  tricountEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPlaylist?: boolean;

  @IsUrl()
  @IsOptional()
  playlistUrl?: string;
}

export class CancelEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class UpdateRsvpDto {
  @IsEnum(RsvpStatus)
  status: RsvpStatus;
}

export class CreateNeedDto {
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  amount: number;

  @IsArray()
  @IsString({ each: true })
  participantIds: string[];
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;
}

export class ReportCommentDto {
  @IsString()
  @IsOptional()
  @MaxLength(280)
  reason?: string;
}
