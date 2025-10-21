import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server } from 'http';

let cachedServer: Server;

export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: ['http://localhost:5173', 'https://your-frontend-domain.vercel.app'],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
  }

  // 🔧 NestJS server instance orqali so‘rovni Vercel’ga yo‘naltiramiz
  (cachedServer as any).emit('request', req, res);
}
