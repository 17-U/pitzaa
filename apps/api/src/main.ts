import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — nécessaire pour vérifier la signature des webhooks de paiement,
  // qui se calcule sur le corps brut de la requête, avant tout parsing JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pitzaa API')
    .setDescription(
      "API de partage d'abonnements et de cartes cadeaux — paiements mobile money (XAF)",
    )
    .setVersion('0.0.1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = process.env.API_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
