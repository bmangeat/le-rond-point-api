import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ------------------------------------------------------------------
  // Inscription email / mot de passe
  // ------------------------------------------------------------------
  async register(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà pour cet email');
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, name, password: hashed },
    });

    return this.generateTokens(user.id, user.email);
  }

  // ------------------------------------------------------------------
  // Connexion email / mot de passe
  // ------------------------------------------------------------------
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Message générique : ne pas révéler si l'email existe
    if (!user || !user.password || !user.isActive) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    return this.generateTokens(user.id, user.email);
  }

  // ------------------------------------------------------------------
  // Google Sign-In (mobile) — vérifie l'idToken renvoyé par le SDK mobile
  // ------------------------------------------------------------------
  async signInWithGoogle(idToken: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new UnauthorizedException('Token Google invalide');
    }

    const { email, name, picture, sub: googleId } = payload;

    // Upsert user (crée si inexistant, met à jour l'image sinon)
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { image: picture ?? undefined },
      create: {
        email,
        name: name ?? email.split('@')[0],
        image: picture ?? null,
      },
    });

    // Lier le compte Google (Account NextAuth-compatible)
    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: googleId,
      },
    });

    return this.generateTokens(user.id, user.email);
  }

  // ------------------------------------------------------------------
  // Génération des tokens JWT
  // ------------------------------------------------------------------
  generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }

  // ------------------------------------------------------------------
  // Refresh token
  // ------------------------------------------------------------------
  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; email: string };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return this.generateTokens(user.id, user.email);
  }
}
