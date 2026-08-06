import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => {
  const port = process.env.MINIO_PORT || '9000';
  const rawEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const endpoint = rawEndpoint.startsWith('http')
    ? rawEndpoint
    : `http://${rawEndpoint}:${port}`;

  const publicRawEndpoint = process.env.MINIO_PUBLIC_ENDPOINT || 'localhost';
  const publicEndpoint = publicRawEndpoint.startsWith('http')
    ? publicRawEndpoint
    : `http://${publicRawEndpoint}:${port}`;

  return {
    endpoint,
    publicEndpoint,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'streamtube',
    region: process.env.MINIO_REGION || 'us-east-1',
  };
});
