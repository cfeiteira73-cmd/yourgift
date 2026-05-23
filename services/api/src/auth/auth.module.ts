import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AppleStrategy } from './strategies/apple.strategy';
import { IdentityResolverService } from './identity-resolver.service';
import { AuthRiskService } from './auth-risk.service';
import { SessionAuthorityService } from './session-authority.service';
import { IdentityGraphService } from './identity-graph.service';
import { IdentityGraphController } from './identity-graph.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    AppleStrategy,
    IdentityResolverService,
    AuthRiskService,
    SessionAuthorityService,
    IdentityGraphService,
  ],
  controllers: [AuthController, IdentityGraphController],
  exports: [AuthService, IdentityResolverService, AuthRiskService, SessionAuthorityService, IdentityGraphService],
})
export class AuthModule {}
