import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
}

interface ValidatedUser {
  userId: string;
  email: string;
  fullName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'this_is_a_super_secret_key',
    });

    // DEBUG: Strategy yaratilganda
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    try {

      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }
      const user = await this.userModel.findById(payload.sub).exec();

      if (!user) {
        throw new UnauthorizedException('User not found');
      }


      const result: ValidatedUser = {
        userId: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
      };


      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }
}