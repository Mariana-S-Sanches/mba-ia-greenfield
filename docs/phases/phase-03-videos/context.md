# Context: Phase 03 - Videos

## Visão Geral
Nesta fase, introduziremos a capacidade core do StreamTube: **Upload, Armazenamento, Processamento e Entrega de Vídeos**.

## Objetivos e Escopo
- **Object Storage**: Integração do MinIO (S3-compatible) no ecossistema Docker para armazenar arquivos grandes sem sobrecarregar o Node.js.
- **Upload Inteligente**: Implementação de Multipart Upload usando Presigned URLs. O frontend enviará os chunks do vídeo diretamente para o MinIO, contornando a API NestJS e garantindo resiliência (retomada de upload).
- **Processamento Assíncrono**: Criação de um pipeline usando `BullMQ` (via Redis) e um worker independente rodando `ffmpeg` em container separado para extrair metadados e gerar thumbnails dos vídeos recém-enviados.
- **Máquina de Estados Segura**: Controle estrito do ciclo de vida do vídeo no banco de dados (`DRAFT` → `PROCESSING` → `READY` ou `ERROR`).
- **Streaming Performático**: Distribuição do vídeo gerando requisições com suporte a `Range` diretamente ao Storage via Presigned URLs, poupando CPU e banda da API Rest.

## Alinhamento Arquitetural
As decisões tomadas seguem a premissa de não onerar a API HTTP principal (`nestjs-api`) com fluxos binários intensos, delegando as operações de I/O de rede intensivo para o MinIO e as operações de CPU intensivo para um container Worker secundário.
