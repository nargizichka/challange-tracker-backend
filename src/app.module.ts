import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? '', {
      dbName: 'challenge-tracker',
    }),
    AuthModule,
    ChallengesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
