import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { CustomLoggerService } from './shared/logger/logger.service';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    bufferLogs: !isProduction,
    logger: isProduction
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'],
  });

  // ==========================================
  // Development Logging
  // ==========================================

  if (!isProduction) {
    const logger = app.get(CustomLoggerService);

    logger.setContext('Bootstrap');

    app.useLogger(logger);
    app.useGlobalInterceptors(new LoggingInterceptor(logger));
    app.useGlobalFilters(new AllExceptionsFilter(logger));
  }

  // ==========================================
  // Validation
  // ==========================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ==========================================
  // CORS
  // ==========================================

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // ==========================================
  // Swagger
  // Development only
  // ==========================================

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Reservation System API')
      .setDescription('API documentation for the Reservation System')
      .setVersion('1.0')
      .addTag('auth', 'Authentication endpoints')
      .addTag('resources', 'Resource management')
      .addTag('availability', 'Availability checking')
      .addTag('bookings', 'Booking management')
      .addTag('payments', 'Payment processing')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api', app, document);
  }

  // ==========================================
  // Start Server
  // ==========================================

  const port = process.env.PORT ?? 5000;

  // IMPORTANT for Docker
  await app.listen(port, '0.0.0.0');

  if (!isProduction) {
    const logger = app.get(CustomLoggerService);

    logger.log(`Application is running on: http://localhost:${port}`);
    logger.log(`Swagger documentation: http://localhost:${port}/api`);
  } else {
    console.log(`Application is running on: http://localhost:${port}`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});