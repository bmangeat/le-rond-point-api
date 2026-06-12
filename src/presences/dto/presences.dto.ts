import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Availability } from '@prisma/client';

export class CreatePresenceDto {
  @IsDateString()
  startDate: string; // YYYY-MM-DD → converti en minuit UTC

  @IsDateString()
  endDate: string;

  @IsEnum(Availability)
  @IsOptional()
  availability?: Availability;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  note?: string;
}

export class UpdatePresenceDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(Availability)
  @IsOptional()
  availability?: Availability;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  note?: string;
}
