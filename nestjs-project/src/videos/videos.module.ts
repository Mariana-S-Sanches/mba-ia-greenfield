import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Video } from './entities/video.entity';
import { Channel } from '../channels/entities/channel.entity';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { VideosProcessor } from './videos.processor';
import { VideosCronService } from './videos.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, Channel]),
    BullModule.registerQueue({
      name: 'videos',
    }),
    StorageModule,
    AuthModule,
  ],
  controllers: [VideosController],
  providers: [VideosService, VideosProcessor, VideosCronService],
})
export class VideosModule {}
