import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from './entities/video.entity';
import { Channel } from '../channels/entities/channel.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { StorageService } from '../storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VideoStatus } from './enums/video-status.enum';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    private readonly storageService: StorageService,
    @InjectQueue('videos')
    private readonly videosQueue: Queue,
  ) {}

  async create(userId: string, createVideoDto: CreateVideoDto) {
    const channel = await this.channelRepo.findOneBy({ user_id: userId });
    if (!channel) {
      throw new NotFoundException('Channel not found for current user');
    }

    const video = this.videoRepo.create({
      title: createVideoDto.title,
      description: createVideoDto.description,
      channelId: channel.id,
      status: VideoStatus.DRAFT,
    });
    
    // Save to generate referenceId
    const savedVideo = await this.videoRepo.save(video);
    
    // Create multipart upload in MinIO
    const fileKey = `channels/${channel.id}/${savedVideo.referenceId}.mp4`;
    const uploadId = await this.storageService.createMultipartUpload(fileKey, 'video/mp4');
    
    savedVideo.uploadId = uploadId;
    savedVideo.fileKey = fileKey;
    await this.videoRepo.save(savedVideo);

    return {
      id: savedVideo.id,
      referenceId: savedVideo.referenceId,
      status: savedVideo.status,
      uploadId: savedVideo.uploadId,
    };
  }

  async getUploadPartUrl(userId: string, referenceId: string, partNumber: number) {
    const video = await this.videoRepo.findOne({
      where: { referenceId },
      relations: ['channel'],
    });

    if (!video) throw new NotFoundException('Video not found');
    if (video.channel.user_id !== userId) throw new ForbiddenException('Not your video');
    if (video.status !== VideoStatus.DRAFT) throw new BadRequestException('Video is not in DRAFT status');
    if (!video.uploadId || !video.fileKey) throw new BadRequestException('Multipart upload not initialized');

    const url = await this.storageService.getPresignedUrlForPart(video.fileKey, video.uploadId, partNumber);
    return { url };
  }

  async completeUpload(userId: string, referenceId: string, completeUploadDto: CompleteUploadDto) {
    const video = await this.videoRepo.findOne({
      where: { referenceId },
      relations: ['channel'],
    });

    if (!video) throw new NotFoundException('Video not found');
    if (video.channel.user_id !== userId) throw new ForbiddenException('Not your video');
    if (video.status !== VideoStatus.DRAFT) throw new BadRequestException('Video is not in DRAFT status');
    if (!video.uploadId || !video.fileKey) throw new BadRequestException('Multipart upload not initialized');

    // Complete in MinIO
    await this.storageService.completeMultipartUpload(video.fileKey, video.uploadId, completeUploadDto.parts);

    // Update status to PROCESSING
    video.status = VideoStatus.PROCESSING;
    await this.videoRepo.save(video);

    // Dispatch job to BullMQ
    await this.videosQueue.add('process-video', {
      videoId: video.id,
      referenceId: video.referenceId,
      fileKey: video.fileKey,
    });

    return {
      referenceId: video.referenceId,
      status: video.status,
    };
  }

  async getVideoMetadata(referenceId: string) {
    const video = await this.videoRepo.findOne({
      where: { referenceId },
    });

    if (!video) throw new NotFoundException('Video not found');

    return {
      title: video.title,
      description: video.description,
      duration: video.duration,
      status: video.status,
      thumbnailKey: video.thumbnailKey,
    };
  }

  async getVideoStream(referenceId: string, range?: string) {
    const video = await this.videoRepo.findOne({
      where: { referenceId },
    });

    if (!video) throw new NotFoundException('Video not found');
    if (!video.fileKey) throw new BadRequestException('Video file not available');
    // We allow streaming if READY. Could allow PROCESSING if part of the file is there but let's restrict to READY.
    if (video.status !== VideoStatus.READY && video.status !== VideoStatus.PROCESSING) {
       // Wait, req says "download dos vídeos já processados". We should restrict to READY
    }
    if (video.status !== VideoStatus.READY) throw new BadRequestException('Video is not ready');

    return this.storageService.getObjectStream(video.fileKey, range);
  }

  async getVideoDownload(referenceId: string) {
    const video = await this.videoRepo.findOne({
      where: { referenceId },
    });

    if (!video) throw new NotFoundException('Video not found');
    if (!video.fileKey) throw new BadRequestException('Video file not available');
    if (video.status !== VideoStatus.READY) throw new BadRequestException('Video is not ready');

    const streamData = await this.storageService.getObjectStream(video.fileKey);
    return {
      title: video.title,
      stream: streamData.stream,
    };
  }
}
