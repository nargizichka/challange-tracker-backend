import { Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    gender: string;
    birthday: Date;
    role: string;
    joinDate: Date;
    totalChallenges?: number;
    completedChallenges?: number;
    currentStreak?: number;
    longestStreak?: number;
  };
}

interface LeanUser {
  _id: any;
  fullName: string;
  email: string;
  password: string;
  gender: string;
  birthday: Date;
  role: string;
  joinDate: Date;
  totalChallenges?: number;
  completedChallenges?: number;
  currentStreak?: number;
  longestStreak?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<LoginResponse> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = new this.userModel({
      ...dto,
      password: hashed,
      joinDate: new Date()
    });
    await user.save();

    const token = this.generateToken(user);
    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .lean()
      .exec() as LeanUser;

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const token = this.generateTokenFromLean(user);
    return {
      access_token: token,
      user: this.sanitizeLeanUser(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) throw new NotFoundException('User not found');

    return {
      user: this.sanitizeUser(user),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Check if email is being changed and if it's already taken
    if (dto.email && dto.email !== user.email) {
      const existing = await this.userModel.findOne({ email: dto.email });
      if (existing) throw new ConflictException('Email already exists');
    }

    Object.assign(user, dto);
    await user.save();

    return {
      user: this.sanitizeUser(user),
      message: 'Profile updated successfully'
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Validate new password
    if (dto.newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long');
    }

    // Hash and save new password
    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return {
      message: 'Password changed successfully'
    };
  }

  async getUserStats(userId: string) {
    const user = await this.userModel.findById(userId).select('totalChallenges completedChallenges currentStreak longestStreak');
    if (!user) throw new NotFoundException('User not found');

    return {
      totalChallenges: user.totalChallenges || 12,
      completedChallenges: user.completedChallenges || 8,
      currentStreak: user.currentStreak || 15,
      longestStreak: user.longestStreak || 28
    };
  }

  private generateToken(user: UserDocument): string {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  private generateTokenFromLean(user: LeanUser): string {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  private sanitizeUser(user: UserDocument): LoginResponse['user'] {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      gender: user.gender,
      birthday: user.birthday,
      role: user.role,
      joinDate: user.joinDate,
      totalChallenges: user.totalChallenges || 0,
      completedChallenges: user.completedChallenges || 0,
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
    };
  }

  private sanitizeLeanUser(user: LeanUser): LoginResponse['user'] {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      gender: user.gender,
      birthday: user.birthday,
      role: user.role,
      joinDate: user.joinDate,
      totalChallenges: user.totalChallenges || 0,
      completedChallenges: user.completedChallenges || 0,
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
    };
  }
}