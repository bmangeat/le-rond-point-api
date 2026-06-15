import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleSignInDto, RefreshTokenDto } from './dto/google-signin.dto';
import { RegisterDto, LoginDto } from './dto/email-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Inscription email / mot de passe
   * Retourne accessToken (15min) + refreshToken (30j)
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  /**
   * POST /api/auth/login
   * Connexion email / mot de passe
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /api/auth/google
   * Mobile → envoie l'idToken récupéré via Google Sign-In SDK
   * Retourne accessToken (15min) + refreshToken (30j)
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  signInWithGoogle(@Body() dto: GoogleSignInDto) {
    return this.authService.signInWithGoogle(dto.idToken);
  }

  /**
   * POST /api/auth/refresh
   * Renouvelle l'accessToken avec le refreshToken
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }
}
