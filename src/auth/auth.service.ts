import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, Role } from '../shared/dto/create-user.dto';
import { LoginDto } from '../shared/dto/login.dto';
import { NotificationService } from '../notification/notification.service';
import { CustomLoggerService } from '../shared/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
    private logger: CustomLoggerService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.logger.setContext('AuthService');
  }
  private issueDemoAdminToken() {
    const token = this.jwtService.sign({
      userId: -1,
      email: 'demo.admin@example.com',
      role: Role.ADMIN,
      name: 'Demo Admin',
    });

    return {
      id: -1,
      email: 'demo.admin@example.com',
      name: 'Demo Admin',
      role: Role.ADMIN,
      emailVerified: true,
      token,
      demo: true,
    };
  }

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private otpExpiresAt(minutes = 10): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private async issueOtp(
    userId: number,
    email: string,
    purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD',
  ) {
    const code = this.generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    
    const redisKey = `${email}:${purpose}`;
    const otpData = {
      userId,
      codeHash,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    
    await this.redisService.set(redisKey, JSON.stringify(otpData), 600);

    try {
      await this.notificationService.sendOtpEmail(email, code, purpose);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error.message);
      throw new InternalServerErrorException(
        'Failed to send verification email. Please check your email configuration or try again later.',
      );
    }
  }

  async register(createUserDto: CreateUserDto) {
    const { email, password, name, role = Role.USER } = createUserDto;

    this.logger.log(`Registration attempt for email: ${email}`);

    let existingUser: any;
    try {
      existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      this.logger.error(`Database error checking existing user for ${email}:`, error.message);
      throw new InternalServerErrorException(
        'Unable to connect to the database. Please try again later.',
      );
    }

    if (existingUser) {
      this.logger.warn(`Registration failed: User already exists - ${email}`);
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user: any;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
        },
      });
    } catch (error) {
      this.logger.error(`Database error creating user for ${email}:`, error.message);
      throw new InternalServerErrorException(
        'Unable to create user account. Please try again later.',
      );
    }

    this.logger.log(`User registered successfully: ${user.email} (ID: ${user.id})`);
    
    try {
      await this.issueOtp(user.id, user.email, 'REGISTER');
      this.logger.log(`OTP sent for registration: ${user.email}`);
    } catch (error) {
      await this.prisma.user.delete({ where: { id: user.id } });
      this.logger.error(`Failed to send OTP, user deleted: ${user.email}`);
      throw error;
    }

    return {
      message: 'OTP code sent to your email',
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: false,
      requiresOtp: true,
      purpose: 'REGISTER',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    this.logger.log(`Login attempt for email: ${email}`);

    const demoEmail = this.configService.get<string>('DEMO_ADMIN_EMAIL');
    const demoPassword = this.configService.get<string>('DEMO_ADMIN_PASSWORD');
    if (demoEmail && demoPassword && email === demoEmail && password === demoPassword) {
      this.logger.log('Demo admin login matched, issuing admin token without OTP');
      return this.issueDemoAdminToken();
    }

    let user: any;
    try {
      user = (await this.prisma.user.findUnique({
        where: { email },
      })) as any;
    } catch (error) {
      this.logger.error(`Database error during login for ${email}:`, error.message);
      throw new InternalServerErrorException(
        'Unable to connect to the database. Please try again later.',
      );
    }

    if (!user) {
      this.logger.warn(`Login failed: User not found - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      this.logger.warn(`Login failed: Account locked - ${email} (${remainingMinutes} minutes remaining)`);
      throw new UnauthorizedException(`Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newAttempts = user.loginAttempts + 1;
      const maxAttempts = 5;
      const lockoutMinutes = 15;

      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        try {
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: newAttempts,
              lockedUntil,
            },
          });
        } catch (error) {
          this.logger.error(`Database error updating login attempts for ${email}:`, error.message);
        }
        this.logger.warn(`Account locked due to ${maxAttempts} failed attempts - ${email}`);
        throw new UnauthorizedException(`Account locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minutes.`);
      } else {
        try {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: newAttempts },
          });
        } catch (error) {
          this.logger.error(`Database error updating login attempts for ${email}:`, error.message);
        }
        const remainingAttempts = maxAttempts - newAttempts;
        this.logger.warn(`Login failed: Invalid password - ${email} (${newAttempts}/${maxAttempts} attempts, ${remainingAttempts} remaining)`);
        throw new UnauthorizedException(`Invalid credentials. ${remainingAttempts} attempt(s) remaining before account lockout.`);
      }
    }

    // Reset login attempts on successful password verification
    if (user.loginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    await this.issueOtp(user.id, user.email, 'LOGIN');
    this.logger.log(`OTP sent for login: ${user.email}`);
    return {
      message: 'OTP code sent to your email',
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      requiresOtp: true,
      purpose: 'LOGIN',
    };
  }

  async verifyOtp(email: string, code: string, purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD') {
    this.logger.log(`OTP verification attempt for email: ${email}, purpose: ${purpose}`);

    let user: any;
    try {
      user = (await this.prisma.user.findUnique({
        where: { email },
      })) as any;
    } catch (error) {
      this.logger.error(`Database error finding user for ${email}:`, error.message);
      throw new InternalServerErrorException(
        'Unable to connect to the database. Please try again later.',
      );
    }

    if (!user) {
      this.logger.warn(`OTP verification failed: User not found - ${email}`);
      throw new UnauthorizedException('Invalid OTP');
    }

    const redisKey = `${email}:${purpose}`;
    const otpDataStr = await this.redisService.get<string>(redisKey);

    if (!otpDataStr) {
      this.logger.warn(`OTP verification failed: No OTP found - ${email}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const otpData = JSON.parse(otpDataStr);

    if (otpData.attempts >= 5) {
      this.logger.warn(`OTP verification failed: Too many attempts - ${email}`);
      await this.redisService.delete(redisKey);
      throw new UnauthorizedException('Too many attempts');
    }

    const ok = await bcrypt.compare(code, otpData.codeHash);
    if (!ok) {
      otpData.attempts += 1;
      await this.redisService.set(redisKey, JSON.stringify(otpData), 600);
      this.logger.warn(`OTP verification failed: Invalid code - ${email} (Attempt ${otpData.attempts})`);
      throw new UnauthorizedException('Invalid OTP');
    }

    this.logger.log(`OTP verified successfully for ${email}`);

    await this.redisService.delete(redisKey);

    if (purpose === 'RESET_PASSWORD') {
      return {
        ok: true,
      };
    }

    if (!user.emailVerified) {
      await (this.prisma.user as any).update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const token = this.jwtService.sign({ 
      userId: user.id, 
      email: user.email,
      role: user.role 
    });
    this.logger.log(`JWT token generated for user: ${user.email}`);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: true,
      token,
    };
  }

  async resendOtp(email: string, purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD') {
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    const redisKey = `${email}:${purpose}`;
    const existingOtpStr = await this.redisService.get<string>(redisKey);

    if (existingOtpStr) {
      const existingOtp = JSON.parse(existingOtpStr);
      const cooldownMs = 60 * 1000;
      const createdAt = new Date(existingOtp.createdAt).getTime();
      if (createdAt + cooldownMs > Date.now()) {
        throw new UnauthorizedException('Please wait before requesting another code');
      }
    }

    try {
      await this.issueOtp(user.id, user.email, purpose);
    } catch (error) {
      this.logger.error(`Failed to resend OTP to ${email}:`, error.message);
      throw error;
    }

    return {
      ok: true,
      message: 'OTP code sent to your email',
    };
  }

  async forgotPassword(email: string) {
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (user) {
      try {
        await this.issueOtp(user.id, user.email, 'RESET_PASSWORD');
      } catch (error) {
        this.logger.error(`Failed to send password reset OTP to ${email}:`, error.message);
        throw error;
      }
    }

    return {
      message: 'If an account with that email exists, a password reset code was sent.',
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    this.logger.log(`Password reset attempt for email: ${email}`);

    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (!user) {
      this.logger.warn(`Password reset failed: User not found - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const redisKey = `${email}:RESET_PASSWORD`;
    const otpDataStr = await this.redisService.get<string>(redisKey);

    if (!otpDataStr) {
      this.logger.warn(`Password reset failed: No OTP found - ${email}`);
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const otpData = JSON.parse(otpDataStr);

    if (otpData.attempts >= 5) {
      this.logger.warn(`Password reset failed: Too many attempts - ${email}`);
      await this.redisService.delete(redisKey);
      throw new UnauthorizedException('Too many attempts');
    }

    const ok = await bcrypt.compare(code, otpData.codeHash);
    if (!ok) {
      otpData.attempts += 1;
      await this.redisService.set(redisKey, JSON.stringify(otpData), 600);
      this.logger.warn(`Password reset failed: Invalid code - ${email} (Attempt ${otpData.attempts})`);
      throw new UnauthorizedException('Invalid reset code');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.redisService.delete(redisKey);

    this.logger.log(`Password reset successfully for ${email}`);

    return {
      message: 'Password reset successfully',
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    this.logger.log(`Password change attempt for user ID: ${userId}`);

    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (!user) {
      this.logger.warn(`Password change failed: User not found - ID: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) {
      this.logger.warn(`Password change failed: Incorrect old password - User ID: ${userId}`);
      throw new UnauthorizedException('Old password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password changed successfully for user ID: ${userId}`);

    return {
      message: "password changed successfully",
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Return user without password
    const { password: _, ...result } = user;
    return result;
  }

  async validateUserById(userId: number) {
    // Allow demo admin (not persisted in DB)
    if (userId === -1) {
      return {
        id: -1,
        email: 'demo.admin@example.com',
        name: 'Demo Admin',
        role: Role.ADMIN,
        image: null,
        createdAt: new Date(),
        demo: true,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
