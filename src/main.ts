import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import type { Express } from 'express';

let cachedApp: INestApplication | null = null;
let cachedHandler: Express | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    await app.init();
    cachedApp = app;

    // Tipni bu tarzda aniq qilib beramiz
    cachedHandler = app.getHttpAdapter().getInstance() as Express;
  }

  return (cachedHandler as any)(req, res);
}
