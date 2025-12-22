import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, Role } from '../shared/dto/create-user.dto';
import { LoginDto } from '../shared/dto/login.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

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

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
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

    await this.issueOtp(user.id, user.email, 'REGISTER');

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

    // Find user
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.issueOtp(user.id, user.email, 'LOGIN');
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
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as any;

    if (!user) {
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
      throw new UnauthorizedException('Invalid OTP');
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP expired');
    }

    if (otp.attempts >= 5) {
      throw new UnauthorizedException('Too many attempts');
    }

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

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
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

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
