# Phase 03 - Videos: Technical Decisions

## 1. Tecnologia de Fila de Processamento
- **Opções:** BullMQ (Redis), RabbitMQ, Amazon SQS, Kafka.
- **Prós/Contras:**
  - *BullMQ (Redis):* Nativo do ecossistema NestJS/Node, fácil setup, suporta retries, delays e cron. Ideal para projetos pequenos/médios. Ocupa memória RAM para os jobs, mas processamento de vídeo é baixo volume/alta duração.
  - *RabbitMQ:* Muito robusto para mensageria complexa, mas adiciona complexidade de setup e manutenção (Erlang, exchanges, queues).
  - *SQS/Kafka:* Overhead desnecessário para o momento (Greenfield local).
- **Decisão:** **BullMQ (apoiado por Redis)**. O NestJS tem pacote oficial (`@nestjs/bullmq`), sendo a escolha mais pragmática e com excelente suporte para retries e controle de concorrência.

## 2. Estratégia de Upload de Arquivos Grandes (até 10GB)
- **Opções:** Upload via API NestJS, Direct Upload simples, Direct Upload com Multipart (Presigned URLs).
- **Prós/Contras:**
  - *Upload via API NestJS:* Fácil de validar, mas engargala o Node.js (bloqueando event loop ou usando muita memória/banda do servidor backend).
  - *Direct Upload (Presigned URL simples):* Desvia tráfego da API, mas arquivos de 10GB falharão com quedas de conexão, sem poder retomar.
  - *Direct Upload com Multipart Presigned URLs:* Permite fatiamento do upload (chunks). Se a conexão cair, apenas as partes pendentes são re-enviadas.
- **Decisão:** **Direct Upload com Multipart Presigned URLs (MinIO/S3)**. A API NestJS criará o recurso como `DRAFT` e orquestrará a geração das URLs de upload das partes, mas o cliente fará o upload direto para o MinIO.

## 3. Arquitetura do Worker de Vídeo (FFmpeg)
- **Opções:** Processamento na mesma aplicação NestJS vs. Container Worker separado.
- **Prós/Contras:**
  - *Na mesma aplicação:* Simples, mas o FFmpeg consome muita CPU e pode comprometer a resposta HTTP da API principal, além de forçar a API a ter o binário do FFmpeg.
  - *Container Worker separado:* Isola recursos (CPU/Memória), permite escalar workers separadamente da API, e o ambiente pode ter dependências específicas de sistema operacional.
- **Decisão:** **Worker em Container Separado**. Será um micro-serviço executando em um container Docker exclusivo que possui o binário do `ffmpeg` instalado. Ele escutará a fila do BullMQ, fará download do vídeo do MinIO, processará metadados/thumbnails e salvará os resultados.

## 4. Estratégia de Streaming de Vídeo
- **Opções:** Streaming passando pela API NestJS (Range headers manuais) vs. Acesso direto (ou Presigned URLs) ao MinIO/S3.
- **Prós/Contras:**
  - *Streaming via API:* Permite checagem de autorização em tempo real e ofusca a URL, mas força o tráfego pesado a passar pela API.
  - *Acesso Direto / Presigned URLs no Storage:* O storage é otimizado para responder a `Range` requests (HTTP 206) em arquivos grandes, poupando a API completamente.
- **Decisão:** **URLs do Storage (Presigned para privados, públicas para públicos)**. A API apenas servirá os metadados do vídeo e a URL (ou Presigned URL válida por pouco tempo) do MinIO. O player do frontend solicitará os pedaços (Range requests) diretamente do Object Storage, que suporta isso nativamente.

## 5. Estratégia de Resiliência e Status no Pipeline
- **Problema:** Um vídeo pode falhar no upload, corromper, ou o FFmpeg pode quebrar.
- **Decisão:** A entidade `Video` terá uma máquina de estados rigorosa: `DRAFT` (upload em andamento) -> `PROCESSING` (na fila/FFmpeg) -> `READY` (publicado/processado) ou `ERROR` (falha).
  - *Upload Incompleto:* Rotinas de limpeza (cron) para expurgar vídeos em `DRAFT` após 24h sem progresso, abortando o Multipart Upload no MinIO.
  - *Worker Retries:* O BullMQ será configurado com retries exponenciais em caso de falha transiente (ex: rede). Falhas permanentes (vídeo corrompido) atualizarão o status para `ERROR`.
  - *Dead Letter Queue (DLQ):* Jobs reprovados persistentemente cairão numa DLQ para inspeção manual.
