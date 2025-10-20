import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Get('debug-headers')
  debugHeaders(@Req() req: Request) {
    return { authorization: req.headers['authorization'] || null };
  }
}
