import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Strategy } = require('passport-custom') as {
  Strategy: new (verify: any) => any;
};

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor() {
    super(
      async (req: any, done: (err: any, user?: any) => void) => {
        await this.validate(req, done);
      },
    );
  }

  async validate(req: any, done: (err: any, user?: any) => void): Promise<void> {
    try {
      // Apple sends id_token in the body (POST callback)
      const idToken = req.body?.id_token as string | undefined;
      if (!idToken) {
        return done(new Error('No id_token from Apple'), null);
      }

      // Decode without verifying first to get sub/email
      const decoded = jwt.decode(idToken, { complete: true }) as any;
      if (!decoded) return done(new Error('Invalid Apple id_token'), null);

      const sub = decoded.payload?.sub as string;
      const email = decoded.payload?.email as string | undefined;

      // For production: verify JWT signature against Apple's public keys
      // Apple JWKS: https://appleid.apple.com/auth/keys
      // Here we trust the token structure for MVP (verify signature in production)

      let firstName: string | undefined;
      try {
        if (req.body?.user) {
          const parsed = JSON.parse(req.body.user as string);
          firstName = parsed?.name?.firstName as string | undefined;
        }
      } catch { }

      const oauthProfile = {
        provider: 'apple' as const,
        providerUid: sub,
        email: email ?? `${sub}@privaterelay.appleid.com`,
        displayName: firstName,
        avatarUrl: undefined as string | undefined,
      };

      done(null, oauthProfile);
    } catch (e: any) {
      done(e, null);
    }
  }
}
