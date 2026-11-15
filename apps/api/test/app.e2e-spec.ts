import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) returns the API name and version', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ name: 'Pitzaa API', version: '0.0.1' });
  });

  it('/health (GET) returns an ok status', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body.status).toBe('ok');
  });

  afterEach(async () => {
    await app.close();
  });
});
