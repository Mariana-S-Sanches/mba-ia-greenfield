import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Video } from './entities/video.entity';
import { VideoStatus } from './enums/video-status.enum';

@Injectable()
export class VideosCronService {
  private readonly logger = new Logger(VideosCronService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupStaleDrafts() {
    this.logger.log('Starting cleanup of stale DRAFT videos...');
    
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const result = await this.videoRepo.delete({
      status: VideoStatus.DRAFT,
      createdAt: LessThan(twentyFourHoursAgo),
    });

    this.logger.log(`Cleaned up ${result.affected} stale DRAFT videos.`);
  }
}
