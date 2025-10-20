import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: {
    userId: string;
    email: string;
    role?: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly service: ChallengesService) {}

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.service.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.findOne(id, req.user.userId);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateChallengeDto) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req: AuthRequest, @Body() dto: UpdateChallengeDto) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.delete(id, req.user.userId);
  }

  @Patch(':id/start')
  start(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.start(id, req.user.userId);
  }

  @Patch(':id/stop')
  stop(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.stop(id, req.user.userId);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.complete(id, req.user.userId);
  }

  @Post(':id/restart')
  restart(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.restart(id, req.user.userId);
  }

  @Post('today/track')
  async createTodayTrack(@Req() req) {
    return await this.service.createTodayTrack(req.user.userId);
  }

  @Get('today/track')
  async findTodayTrack(@Req() req) {
    return await this.service.findTodayTrack(req.user.userId);
  }

  @Patch('today/toggle-task/:taskIndex')
  async toggleTask(@Param('taskIndex') taskIndex: number, @Req() req) {
    return await this.service.toggleTask(
      req.user.userId,
      parseInt(taskIndex.toString(), 10),
    );
  }

  @Patch('today/toggle-task-by-id/:taskId')
  async toggleTaskById(@Param('taskId') taskId: string, @Req() req) {
    return await this.service.toggleTaskById(
      req.user.userId,
      taskId
    );
  }

  @Post('today/end-day')
  async endDay(
    @Body() body: { penalty?: string; successMessage?: string },
    @Req() req,
  ) {
    try {
      return await this.service.endDay(
        req.user.userId,
        body?.penalty,
        body?.successMessage
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to end day',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('stats/progress')
  async getProgressStats(@Req() req) {
    return await this.service.getProgressStats(req.user.userId);
  }

  @Post('debug/fix-time')
  async fixTimeIssues(@Req() req: AuthRequest) {
    return await this.service.fixTimeIssues(req.user.userId);
  }

  @Get('debug/current-time')
  async getCurrentTime() {
    const serverNow = new Date();
    return {
      serverTime: serverNow.toString(),
      serverToday: serverNow.toISOString().split('T')[0],
      utcTime: serverNow.toUTCString(),
      timezoneOffset: serverNow.getTimezoneOffset(),
      timestamp: serverNow.getTime()
    };
  }

  @Get('debug/time-info')
  async getTimeInfo() {
    const serverNow = new Date();
    const serverToday = serverNow.toISOString().split('T')[0];

    // Korreksiya qilingan sana
    const correctedDate = new Date(serverNow);
    correctedDate.setDate(correctedDate.getDate() + 1);
    const correctedToday = correctedDate.toISOString().split('T')[0];

    return {
      serverTime: {
        full: serverNow.toString(),
        today: serverToday,
        iso: serverNow.toISOString(),
        utc: serverNow.toUTCString(),
        timestamp: serverNow.getTime()
      },
      correctedTime: {
        full: correctedDate.toString(),
        today: correctedToday,
        iso: correctedDate.toISOString(),
        utc: correctedDate.toUTCString(),
        timestamp: correctedDate.getTime()
      },
      timezone: {
        offset: serverNow.getTimezoneOffset(),
        locale: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      note: serverToday === '2025-10-18' ?
        '⚠️ SERVER TIME IS WRONG - Using corrected date' :
        '✅ Server time is correct'
    };
  }

  // 🔹 Challenge tracklarini ko'rish
  @Get(':id/tracks')
  async getChallengeTracks(@Param('id') id: string, @Req() req: AuthRequest) {
    return await this.service.getChallengeTracks(id, req.user.userId);
  }

  // 🔹 Challenge uchun barcha tracklarni yaratish (debug)
  @Post('debug/create-all-tracks/:id')
  async createAllTracks(@Param('id') id: string, @Req() req: AuthRequest) {
    return await this.service.createAllTracksForChallengeDebug(id, req.user.userId);
  }

  @Get('progress/overview')
  async getProgressOverview(@Req() req: AuthRequest) {
    return await this.service.getProgressOverview(req.user.userId);
  }


  // challenges.controller.ts ga yangi endpoint qo'shamiz

  @Get('dashboard/data')
  async getDashboardData(@Req() req: AuthRequest) {
    return await this.service.getDashboardData(req.user.userId);
  }

  // challenges.controller.ts ga

  @Post('today/start-day')
  async startDay(@Req() req: AuthRequest) {
    return await this.service.createTodayTrack(req.user.userId);
  }

}