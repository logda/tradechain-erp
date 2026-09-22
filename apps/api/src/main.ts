import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { resolveApiPort } from './app-port';

async function bootstrap() {
  process.env.ERP_DATA_DIR ??= join(process.cwd(), '..', '..', 'work', 'erp-data');
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(resolveApiPort(process.env.PORT));
}

void bootstrap();
