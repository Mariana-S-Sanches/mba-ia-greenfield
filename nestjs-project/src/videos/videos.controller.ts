import { Controller, Post, Get, Body, Param, ParseIntPipe, UseGuards, Req, Res } from '@nestjs/common';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  create(@Req() req: any, @Body() createVideoDto: CreateVideoDto) {
    return this.videosService.create(req.user.sub, createVideoDto);
  }

  @Get(':referenceId/parts/:partNumber')
  getUploadPartUrl(
    @Req() req: any,
    @Param('referenceId') referenceId: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
  ) {
    return this.videosService.getUploadPartUrl(req.user.sub, referenceId, partNumber);
  }

  @Post(':referenceId/complete')
  completeUpload(
    @Req() req: any,
    @Param('referenceId') referenceId: string,
    @Body() completeUploadDto: CompleteUploadDto,
  ) {
    return this.videosService.completeUpload(req.user.sub, referenceId, completeUploadDto);
  }

  @Public()
  @Get(':referenceId')
  getMetadata(@Param('referenceId') referenceId: string) {
    return this.videosService.getVideoMetadata(referenceId);
  }

  @Public()
  @Get(':referenceId/stream')
  async streamVideo(
    @Param('referenceId') referenceId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const range = req.headers.range;
    try {
      const streamData = await this.videosService.getVideoStream(referenceId, range);
      
      if (range) {
        res.status(206);
        res.set({
          'Content-Range': streamData.contentRange,
          'Accept-Ranges': 'bytes',
          'Content-Length': streamData.contentLength,
          'Content-Type': 'video/mp4',
        });
      } else {
        res.status(200);
        res.set({
          'Accept-Ranges': 'bytes',
          'Content-Length': streamData.contentLength,
          'Content-Type': 'video/mp4',
        });
      }

      streamData.stream.pipe(res);
    } catch (err: any) {
      const status = err.status || 500;
      if (err.name === 'NoSuchKey') {
        res.status(404).json({ message: 'Video file not found' });
      } else if (err.name === 'InvalidRange') {
        res.status(416).json({ message: 'Range Not Satisfiable' });
      } else {
        res.status(status).json({ message: err.message || 'Internal server error' });
      }
    }
  }

  @Public()
  @Get(':referenceId/download')
  async downloadVideo(
    @Param('referenceId') referenceId: string,
    @Res() res: any,
  ) {
    try {
      const { title, stream } = await this.videosService.getVideoDownload(referenceId);
      
      // Clean up title to be a valid filename
      const safeTitle = title.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
      
      res.set({
        'Content-Disposition': `attachment; filename="${safeTitle}.mp4"`,
        'Content-Type': 'video/mp4',
      });
      
      stream.pipe(res);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
    }
  }
}
