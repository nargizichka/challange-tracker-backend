import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// UserDocument ni aniq belgilash
export interface UserDocument extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  password: string;
  gender: string;
  birthday: Date;
  role: string;
  joinDate: Date;
  totalChallenges: number;
  completedChallenges: number;
  currentStreak: number;
  longestStreak: number;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  gender: string;

  @Prop({ required: true })
  birthday: Date;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ default: Date.now })
  joinDate: Date;

  @Prop({ default: 0 })
  totalChallenges: number;

  @Prop({ default: 0 })
  completedChallenges: number;

  @Prop({ default: 0 })
  currentStreak: number;

  @Prop({ default: 0 })
  longestStreak: number;

  @Prop()
  lastLogout: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);