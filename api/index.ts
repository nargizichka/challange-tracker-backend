import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let cachedServer: any = null;

async function bootstrapServer() {
  console.log('🔧 Bootstrapping NestJS application...');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log']
    });

    // CORS
    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    // Global prefix
    app.setGlobalPrefix('api');

    await app.init();
    const server = app.getHttpAdapter().getInstance();

    console.log('✅ NestJS application ready');
    return server;

  } catch (error) {
    console.error('❌ Bootstrap error:', error);
    throw error;
  }
}

export default async function handler(req: any, res: any) {
  console.log(`📨 ${req.method} ${req.url}`);

  try {
    if (!cachedServer) {
      cachedServer = await bootstrapServer();
    }

    return cachedServer(req, res);
  } catch (error) {
    console.error('💥 Handler error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error.message
    });
  }
}