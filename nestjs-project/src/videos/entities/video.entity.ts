import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { VideoStatus } from '../enums/video-status.enum';
import * as crypto from 'crypto';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 21 })
  referenceId: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.DRAFT,
  })
  status: VideoStatus;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => Channel, (channel) => channel.videos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  @Column({ type: 'varchar', nullable: true })
  uploadId: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  thumbnailKey: string | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ type: 'varchar', nullable: true })
  resolution: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  generateReferenceId() {
    if (!this.referenceId) {
      // 11 chars using base64url encoding of 8 random bytes
      this.referenceId = crypto.randomBytes(8).toString('base64url');
    }
  }
}
