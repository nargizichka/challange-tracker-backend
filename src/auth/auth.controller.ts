import { Controller, Post, Body, Get, Put, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getUserStats(@Request() req) {
    return this.authService.getUserStats(req.user.userId);
  }
}