import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from './prisma.service';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    NotificationModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: '15m'
        },
      }),
    }),
  ],
  providers: [AuthService, PrismaService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
  exports: [AuthService, PrismaService],
})
export class AuthModule {}
