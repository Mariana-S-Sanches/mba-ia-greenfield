# Library References: Phase 03 - Videos

Abaixo estão listadas as bibliotecas a serem incorporadas, juntamente com o motivo e referências de documentação (a serem consultadas com a ferramenta Context7 antes de usar).

### 1. Object Storage (S3 / MinIO)
- **Pacotes:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- **Motivo:** Padrão ouro (AWS V3 SDK) para integração com APIs compatíveis com S3 (MinIO). Suporta perfeitamente operações de Presigned URL e Multipart Upload.

### 2. Mensageria / Fila Assíncrona
- **Pacotes:** `@nestjs/bullmq`, `bullmq`
- **Motivo:** Framework-native (BullMQ no ecossistema NestJS), backed by Redis. Escolha ideal para background jobs com suporte nativo a concorrência, rate limiting e retries configuráveis.

### 3. Integração com FFmpeg
- **Pacotes:** `fluent-ffmpeg`, `@types/fluent-ffmpeg`
- **Motivo:** Wrapper amigável para chamadas ao binário local do `ffmpeg` no NodeJS. Utilizaremos no worker para gerar a thumbnail e extrair metadados técnicos (duração, dimensões).

### 4. Geração de IDs Públicos Unívocos
- **Pacotes:** `nanoid` (ou `uuid` nativo `crypto.randomUUID()`)
- **Motivo:** Para que os vídeos tenham uma URL pública curta e amigável (ex: YouTube usa IDs similares), em vez de expor o UUIDv4 do banco primário. Usaremos `crypto.randomUUID()` caso seja suficiente, ou nanoid para um ID curto seguro URL-friendly.

### 5. Redis Client (dependência BullMQ)
- **Pacotes:** `ioredis`
- **Motivo:** Cliente robusto de Redis utilizado por baixo dos panos pelo BullMQ.

*Nota: Todas as libs deverão ser instaladas no container `nestjs-api` (e no worker) usando `npm install`.*
