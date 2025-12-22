import { IsEmail, IsString, Length, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ example: 'REGISTER', enum: ['REGISTER', 'LOGIN', 'RESET_PASSWORD'], description: 'OTP purpose' })
  @IsString()
  @IsIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD'])
  purpose!: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD';
}
