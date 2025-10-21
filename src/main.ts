import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS sozlamalari
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global prefix
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT || 3000);
}

// Vercel uchun handler
let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    app.setGlobalPrefix('api');

    await app.init();
    cachedApp = app.getHttpAdapter().getInstance();
  }

  return cachedApp(req, res);
}

// Local development uchun
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(() => {
    console.log('🚀 Server is running on http://localhost:3000');
  });
}