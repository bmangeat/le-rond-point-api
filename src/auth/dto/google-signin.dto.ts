import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleSignInDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
