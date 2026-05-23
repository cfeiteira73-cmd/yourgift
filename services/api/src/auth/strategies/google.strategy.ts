import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Strategy } = require('passport-google-oauth20') as {
  Strategy: new (options: any, verify: any) => any;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID') ?? 'placeholder',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET') ?? 'placeholder',
      callbackURL: config.get('GOOGLE_CALLBACK_URL') ?? 'https://api.yourgift.pt/auth/callback/google',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: (err: any, user?: any) => void) {
    const email: string = profile.emails?.[0]?.value ?? '';
    const oauthProfile = {
      provider: 'google' as const,
      providerUid: profile.id as string,
      email,
      displayName: profile.displayName as string | undefined,
      avatarUrl: profile.photos?.[0]?.value as string | undefined,
    };
    done(null, oauthProfile);
  }
}
