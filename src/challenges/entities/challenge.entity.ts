// challenges/entities/challenge.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type ChallengeDocument = Challenge & Document & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Challenge {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  duration: number;

  @Prop({ default: 'draft', enum: ['draft', 'active', 'completed'] })
  status: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ type: [String], default: [] })
  tasks: string[];

  @Prop({ required: true })
  penalty: string;

  @Prop()
  startDate?: string;

  @Prop()
  endDate?: string;

  // Track ma'lumotlarini challenge ichiga qo'shamiz
  @Prop({ type: [{
      date: { type: String, required: true }, // YYYY-MM-DD
      tasks: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        task: { type: String, required: true },
        completed: { type: Boolean, default: false },
        motivation: String
      }],
      completedTasks: { type: Number, default: 0 },
      totalTasks: { type: Number, default: 0 },
      progress: { type: Number, default: 0 }, // percentage
      dayCompleted: { type: Boolean, default: false },
      penalty: String,
      successMessage: String
    }], default: [] })
  dailyTracks: Array<{
    date: string;
    tasks: Array<{
      _id?: mongoose.Types.ObjectId;
      task: string;
      completed: boolean;
      motivation?: string;
    }>;
    completedTasks: number;
    totalTasks: number;
    progress: number;
    dayCompleted: boolean;
    penalty?: string;
    successMessage?: string;
  }>;

  @Prop({ type: Object, default: {} })
  dailyResults?: Record<string, boolean[]>;

  @Prop({ default: null })
  restartedFrom?: string;
}

export const ChallengeSchema = SchemaFactory.createForClass(Challenge);