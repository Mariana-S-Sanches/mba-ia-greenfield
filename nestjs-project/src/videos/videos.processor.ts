import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from './entities/video.entity';
import { VideoStatus } from './enums/video-status.enum';
const ffmpeg = require('fluent-ffmpeg');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

@Processor('videos')
@Injectable()
export class VideosProcessor extends WorkerHost {
  private readonly logger = new Logger(VideosProcessor.name);

  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { videoId, referenceId, fileKey } = job.data;
    this.logger.log(`Processing video: ${videoId}`);

    const video = await this.videoRepo.findOne({ where: { id: videoId }, relations: ['channel'] });
    if (!video) {
      this.logger.warn(`Video ${videoId} not found`);
      return;
    }

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `${referenceId}.mp4`);
    const thumbFilename = `${referenceId}-thumb.jpg`;
    const thumbPath = path.join(tmpDir, thumbFilename);

    try {
      // 1. Download video
      this.logger.log(`Downloading ${fileKey} to ${inputPath}`);
      await this.storageService.downloadFile(fileKey, inputPath);

      // 2. Get duration
      this.logger.log(`Extracting duration for ${inputPath}`);
      const duration = await this.getDuration(inputPath);

      // 3. Extract thumbnail
      this.logger.log(`Extracting thumbnail for ${inputPath}`);
      await this.extractThumbnail(inputPath, tmpDir, thumbFilename);

      // 4. Upload thumbnail
      const thumbKey = `channels/${video.channel.id}/${thumbFilename}`;
      this.logger.log(`Uploading thumbnail to ${thumbKey}`);
      const thumbBuffer = await fs.promises.readFile(thumbPath);
      await this.storageService.putObject(thumbKey, thumbBuffer, 'image/jpeg');

      // 5. Update DB
      video.duration = duration;
      video.thumbnailKey = thumbKey;
      video.status = VideoStatus.READY;
      await this.videoRepo.save(video);
      this.logger.log(`Video ${videoId} processed successfully.`);
    } catch (error) {
      this.logger.error(`Error processing video ${videoId}:`, error);
      video.status = VideoStatus.ERROR;
      await this.videoRepo.save(video);
      throw error;
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
        if (fs.existsSync(thumbPath)) await fs.promises.unlink(thumbPath);
      } catch (cleanupError) {
        this.logger.error(`Error cleaning up files for ${videoId}:`, cleanupError);
      }
    }
  }

  private getDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const duration = metadata.format.duration;
        resolve(duration ? Math.floor(duration) : 0);
      });
    });
  }

  private extractThumbnail(inputPath: string, folder: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .screenshots({
          count: 1,
          folder: folder,
          filename: filename,
          timestamps: ['00:00:01.000'],
        });
    });
  }
}
