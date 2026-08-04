import { Controller, Post, Get, Body, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
