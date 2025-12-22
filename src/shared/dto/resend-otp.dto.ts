import { IsEmail, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'REGISTER', enum: ['REGISTER', 'LOGIN', 'RESET_PASSWORD'], description: 'OTP purpose' })
  @IsString()
  @IsIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD'])
  purpose!: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD';
}
