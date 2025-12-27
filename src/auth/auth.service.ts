import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, Role } from '../shared/dto/create-user.dto';
import { LoginDto } from '../shared/dto/login.dto';
import { NotificationService } from '../notification/notification.service';
import { CustomLoggerService } from '../shared/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
    private logger: CustomLoggerService,
    private configService: ConfigService,
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
    const expiresAt = this.otpExpiresAt(10);

    await this.prisma.otpCode.upsert({
      where: {
        userId_purpose: {
          userId,
          purpose,
        },
      },
      update: {
        codeHash,
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt,
      },
      create: {
        userId,
        purpose,
        codeHash,
        expiresAt,
      },
    });

    await this.notificationService.sendOtpEmail(email, code, purpose);
  }

  async register(createUserDto: CreateUserDto) {
    const { email, password, name, role = Role.USER } = createUserDto;

    this.logger.log(`Registration attempt for email: ${email}`);

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.logger.warn(`Registration failed: User already exists - ${email}`);
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
    });

    this.logger.log(`User registered successfully: ${user.email} (ID: ${user.id})`);
    await this.issueOtp(user.id, user.email, 'REGISTER');
    this.logger.log(`OTP sent for registration: ${user.email}`);

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

    // Find user
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (!user) {
      this.logger.warn(`Login failed: User not found - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Invalid password - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
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

    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (!user) {
      this.logger.warn(`OTP verification failed: User not found - ${email}`);
      throw new UnauthorizedException('Invalid OTP');
    }

    const otp = await this.prisma.otpCode.findUnique({
      where: {
        userId_purpose: {
          userId: user.id,
          purpose,
        },
      },
    });

    if (!otp) {
      this.logger.warn(`OTP verification failed: No OTP found - ${email}`);
      throw new UnauthorizedException('Invalid OTP');
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      this.logger.warn(`OTP verification failed: OTP expired - ${email}`);
      throw new UnauthorizedException('OTP expired');
    }

    if (otp.attempts >= 5) {
      this.logger.warn(`OTP verification failed: Too many attempts - ${email}`);
      throw new UnauthorizedException('Too many attempts');
    }

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });
      this.logger.warn(`OTP verification failed: Invalid code - ${email} (Attempt ${otp.attempts + 1})`);
      throw new UnauthorizedException('Invalid OTP');
    }

    this.logger.log(`OTP verified successfully for ${email}`);

    if (purpose === 'RESET_PASSWORD') {
      await this.prisma.otpCode.delete({
        where: { id: otp.id },
      });
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

    await this.prisma.otpCode.delete({
      where: { id: otp.id },
    });

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

    const existing = await this.prisma.otpCode.findUnique({
      where: {
        userId_purpose: {
          userId: user.id,
          purpose,
        },
      },
    });

    if (existing) {
      const cooldownMs = 60 * 1000;
      if (existing.lastSentAt.getTime() + cooldownMs > Date.now()) {
        throw new UnauthorizedException('Please wait before requesting another code');
      }
    }

    await this.issueOtp(user.id, user.email, purpose);
    return {
      ok: true,
    };
  }

  async forgotPassword(email: string) {
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (user) {
      await this.issueOtp(user.id, user.email, 'RESET_PASSWORD');
    }

    return {
      message: 'If an account with that email exists, a password reset code was sent.',
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
