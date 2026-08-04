import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigModule } from '@nestjs/config';
import storageConfig from '../config/storage.config';

describe('StorageService (integration)', () => {
  let service: StorageService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [storageConfig],
        }),
      ],
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
    await service.createBucketIfNotExists();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should put and get a simple object', async () => {
    const key = `test-file-${Date.now()}.txt`;
    const content = Buffer.from('hello minio');
    await service.putObject(key, content, 'text/plain');

    const resultStream = await service.getObject(key);
    const chunks: Buffer[] = [];
    for await (const chunk of resultStream) {
      chunks.push(chunk);
    }
    const resultBuffer = Buffer.concat(chunks);
    expect(resultBuffer.toString()).toBe('hello minio');
  });

  it('should complete a multipart upload process', async () => {
    const key = `test-multipart-${Date.now()}.txt`;

    // 1. Create Multipart Upload
    const uploadId = await service.createMultipartUpload(key, 'text/plain');
    expect(uploadId).toBeDefined();
    expect(typeof uploadId).toBe('string');

    // 2. Get Presigned URL for part 1
    const presignedUrl = await service.getPresignedUrlForPart(key, uploadId, 1);
    expect(presignedUrl).toContain(uploadId);
    expect(presignedUrl).toContain('partNumber=1');

    // 3. Upload a part using native fetch
    const partContent = Buffer.from('hello multipart minio');
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: partContent,
    });

    expect(response.ok).toBe(true);

    const eTag = response.headers.get('ETag');
    expect(eTag).toBeDefined();

    // 4. Complete the upload
    await service.completeMultipartUpload(key, uploadId, [
      { ETag: eTag!, PartNumber: 1 },
    ]);

    // 5. Verify upload was successful by getting the object
    const resultStream = await service.getObject(key);
    const chunks: Buffer[] = [];
    for await (const chunk of resultStream) {
      chunks.push(chunk);
    }
    const resultBuffer = Buffer.concat(chunks);
    expect(resultBuffer.toString()).toBe('hello multipart minio');
  });
});
