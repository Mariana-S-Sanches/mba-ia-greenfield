# Plano de Implementação Detalhado: Phase 03 - Videos

## Technical Specifications

### 1. Data Model (Entidade `Video`)
- `id` (uuid, PK)
- `referenceId` (varchar, unívoco, ID público estilo youtube)
- `title` (varchar, max 100)
- `description` (text, opcional)
- `status` (enum: `DRAFT`, `PROCESSING`, `READY`, `ERROR`)
- `channelId` (uuid, FK to Channels, relação M:1)
- `uploadId` (varchar, AWS S3 Multipart Upload ID para acompanhamento interno, nullable)
- `fileKey` (varchar, chave real no MinIO, nullable)
- `thumbnailKey` (varchar, chave da miniatura gerada, nullable)
- `duration` (int, segundos, nullable)
- `resolution` (varchar, ex: '1080p', nullable)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### 2. API Contracts
- `POST /videos`: Autenticado. Payload: `{ title, channelId, description? }`. 
  - Ação: Cria vídeo em `DRAFT`, inicia Multipart Upload no MinIO.
  - Resposta: `Video` model + `uploadId` + lista de `presignedUrls` para N chunks.
- `POST /videos/:id/complete-upload`: Autenticado (dono). Payload: `{ parts: [{ ETag, PartNumber }] }`.
  - Ação: Finaliza o S3 Multipart Upload usando as ETags devolvidas, transita status para `PROCESSING`, publica job no BullMQ.
  - Resposta: Confirmação.
- `GET /videos/:id`: Público ou Autenticado. 
  - Ação: Retorna dados do vídeo, caso esteja READY gera Presigned URL de tempo curto (HTTP 206 suportado nativamente pelo storage).
- `GET /videos`: Paginação de vídeos (filtráveis por channelId).

### 3. Authorization Matrix
- Criar Vídeo / Iniciar Upload: Autenticado + Dono do Canal.
- Finalizar Upload: Autenticado + Dono do Canal.
- Listar / Assistir: Público (para READY). Se for o dono do canal, pode listar DRAFT, PROCESSING, ERROR.

### 4. Message / Event Schemas (BullMQ)
- **Queue:** `video-processing`
- **Job Name:** `extract-metadata-and-thumbnail`
- **Payload:** `{ videoId: string }` (O Worker consultará o banco para buscar a `fileKey`).

---

## Step Implementations (SIs)

### SI-03.1: Infraestrutura (Redis & MinIO)
- Atualizar `compose.yaml` com Redis 7.
- Atualizar `compose.yaml` com MinIO (server e setup via `mc` para garantir que o bucket padrão `streamtube` exista na inicialização).
- Ajustar arquivos `.env.example` e documentação de dev para mapear senhas/usuários desses containers.

### SI-03.2: Database & Entidades Core
- Adicionar entidade `Video` e enum `VideoStatus`.
- Refletir relação no `Channel` (um canal tem muitos vídeos).
- Gerar migrations TypeORM.
- Testes de integração no repositório de vídeo.

### SI-03.3: AWS SDK & Object Storage Module
- Implementar `StorageModule` (wrapper).
- Funções base para: `createMultipartUpload`, `getPresignedUrlForPart`, `completeMultipartUpload`, `generateDownloadPresignedUrl`.
- Escrever os testes unitários (ou usar container do MinIO para testes de integração).

### SI-03.4: Criação de API HTTP de Orquestração (NestJS)
- `VideosController` e `VideosService`.
- Fluxo de inicialização e finalização (`DRAFT` -> `PROCESSING`).
- Políticas de acesso (Guards).

### SI-03.5: O Worker de Processamento (Microservice / Container Independente)
- Criar módulo NestJS exclusivo `WorkerModule` (standalone).
- Configurar `Dockerfile.worker` instalando `ffmpeg`.
- Subir container worker no `compose.yaml` (conectando ao banco e Redis).
- Consumidor (BullMQ `@Processor`) que escuta a fila.
- Fluxo: download do original (via minio/stream local), extrair thumbnail, extrair meta com `fluent-ffmpeg`, upload da thumbnail, update no BD para `READY`.

### SI-03.6: Resiliência, E2E e Cron
- Setup `@nestjs/schedule` para rodar cron varrendo os vídeos em `DRAFT` travados a > 24h e abortando o Multipart Upload na API S3 para economizar espaço.
- Bateria de testes E2E do fluxo de upload (mockando o worker caso fique muito pesado, ou usando pequenos vídeos de fixtures).

---
## Deliverables
- Infra rodando com DB, Redis, Minio, Mail, API e Worker.
- API REST completa com Multipart Upload orquestrado.
- Vídeos processados sem sobrecarregar servidor web Node.js.
- Clean status de todas as suítes de testes (`spec`, `integration`, `e2e`, lint e types).
