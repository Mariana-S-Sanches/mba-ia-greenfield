import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import storageConfig from '../config/storage.config';
import * as fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {
    this.bucketName = this.config.bucket;

    // We force path style for MinIO (bucket name in URL path instead of subdomain)
    this.s3Client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async createBucketIfNotExists(): Promise<void> {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
      } else {
        throw error;
      }
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.s3Client.send(command);
  }

  async getObject(key: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    return response.Body;
  }

  async getObjectStream(key: string, range?: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Range: range,
    });
    const response = await this.s3Client.send(command);
    return {
      stream: response.Body as Readable,
      contentRange: response.ContentRange,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      acceptRanges: response.AcceptRanges,
    };
  }

  async downloadFile(key: string, destPath: string): Promise<void> {
    const body = await this.getObject(key);
    if (body instanceof Readable) {
      await pipeline(body, fs.createWriteStream(destPath));
    } else {
      throw new Error('S3 object body is not a readable stream');
    }
  }

  async createMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    const response = await this.s3Client.send(command);
    if (!response.UploadId) {
      throw new Error('Failed to create multipart upload, missing UploadId');
    }
    return response.UploadId;
  }

  async getPresignedUrlForPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    let url = await getSignedUrl(this.s3Client, command, { expiresIn });
    if (this.config.publicEndpoint && url.startsWith(this.config.endpoint)) {
      url = url.replace(this.config.endpoint, this.config.publicEndpoint);
    }
    return url;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
  ): Promise<void> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });
    await this.s3Client.send(command);
  }
}
