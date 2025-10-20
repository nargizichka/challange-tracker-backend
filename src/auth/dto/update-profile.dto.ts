import { IsEmail, IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(['Male', 'Female', 'Other', 'Prefer not to say'])
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;
}