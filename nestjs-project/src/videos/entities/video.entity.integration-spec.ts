import { DataSource, Repository } from 'typeorm';
import { Video } from './video.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { User } from '../../users/entities/user.entity';
import { VideoStatus } from '../enums/video-status.enum';
import {
  createTestDataSource,
  cleanAllTables,
} from '../../test/create-test-data-source';

describe('Video Entity (integration)', () => {
  let dataSource: DataSource;
  let videoRepo: Repository<Video>;
  let channelRepo: Repository<Channel>;
  let userRepo: Repository<User>;
  let testChannel: Channel;

  beforeAll(async () => {
    dataSource = createTestDataSource([User, Channel, Video]);
    await dataSource.initialize();
    videoRepo = dataSource.getRepository(Video);
    channelRepo = dataSource.getRepository(Channel);
    userRepo = dataSource.getRepository(User);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);

    const user = userRepo.create({
      email: 'creator@test.com',
      password: 'hash',
      is_confirmed: true,
    });
    await userRepo.save(user);

    testChannel = channelRepo.create({
      name: 'Test Channel',
      nickname: 'test-channel',
      user_id: user.id,
    });
    await channelRepo.save(testChannel);
  });

  it('should persist a draft video and generate a referenceId', async () => {
    const video = videoRepo.create({
      title: 'My First Video',
      channelId: testChannel.id,
    });

    const saved = await videoRepo.save(video);
    expect(saved.id).toBeDefined();
    expect(saved.referenceId).toBeDefined();
    expect(saved.referenceId.length).toBe(11);
    expect(saved.status).toBe(VideoStatus.DRAFT);
    expect(saved.createdAt).toBeDefined();
  });

  it('should delete video if channel is deleted', async () => {
    const video = videoRepo.create({
      title: 'To Be Deleted',
      channelId: testChannel.id,
    });
    await videoRepo.save(video);

    await channelRepo.remove(testChannel);
    const count = await videoRepo.count();
    expect(count).toBe(0);
  });
});
