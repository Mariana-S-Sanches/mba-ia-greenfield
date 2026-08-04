import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { StorageService } from '../src/storage/storage.service';

describe('VideosController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let storageService: StorageService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    storageService = app.get(StorageService);

    // Make sure bucket exists
    await storageService.createBucketIfNotExists();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);

    // Register user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'creator@test.com', password: 'password' });

    // Confirm user manually for test
    await dataSource.query('UPDATE users SET is_confirmed = true WHERE email = $1', ['creator@test.com']);

    // Login user
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'creator@test.com', password: 'password' });

    token = loginRes.body.access_token;

    // Create channel
    await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: 'test-channel' });
  });

  it('/videos (POST) - Create a new video in DRAFT status', async () => {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My Awesome Video', description: 'Test description' })
      .expect(201);

    expect(res.body.referenceId).toBeDefined();
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.uploadId).toBeDefined(); // we expose it to tests or client? I actually returned uploadId in service.
  });

  it('/videos/:id/parts/:part (GET) - get presigned URL and complete upload', async () => {
    // 1. Create Video
    const createRes = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Multipart test' });
    
    const referenceId = createRes.body.referenceId;

    // 2. Get Presigned URL
    const partRes = await request(app.getHttpServer())
      .get(`/videos/${referenceId}/parts/1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const url = partRes.body.url;
    expect(url).toBeDefined();

    // 3. Upload a chunk using native fetch
    const chunk = Buffer.from('chunk data 123');
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      body: chunk,
    });
    
    expect(uploadResponse.ok).toBe(true);
    const eTag = uploadResponse.headers.get('ETag');
    expect(eTag).toBeDefined();

    // 4. Complete upload
    const completeRes = await request(app.getHttpServer())
      .post(`/videos/${referenceId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        parts: [{ ETag: eTag, PartNumber: 1 }],
      })
      .expect(201); // default nest post is 201

    expect(completeRes.body.status).toBe('PROCESSING');
  });
});
