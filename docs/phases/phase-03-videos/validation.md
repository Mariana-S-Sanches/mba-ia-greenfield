# Validation & Gap Analysis: Phase 03 - Videos

Esta etapa cruza os requisitos arquiteturais definidos em `technical-decisions-phase-03-videos.md` com o estado atual do repositório para garantir que tudo está alinhado antes da implementação.

## Gaps Identificados

1. **Infraestrutura: Falta Redis**
   - **Problema:** BullMQ requer Redis. Atualmente o `compose.yaml` não possui este serviço.
   - **Solução:** Adicionar container `redis:7-alpine` no Docker Compose.

2. **Infraestrutura: Falta MinIO**
   - **Problema:** Precisamos de Object Storage S3 compatível rodando localmente para testes e deploy e2e.
   - **Solução:** Adicionar container `minio/minio` no Docker Compose, configurado com acesso padrão e `mc` (minio client) para criar os buckets de inicialização.

3. **Arquitetura Worker: Falta de Container para o FFmpeg**
   - **Problema:** Rodar FFmpeg no container da API comprometeria a API.
   - **Solução:** Criar um segundo serviço no `compose.yaml` (ex: `nestjs-worker`) usando uma imagem (ou `Dockerfile.worker`) baseada em Node.js que instala internamente o pacote Alpine/Debian `ffmpeg`. Este serviço não exporá portas HTTP e subirá como um NestJS Standalone Application apenas ouvindo a fila BullMQ.

4. **Banco de Dados: Modelo de Vídeo Inexistente**
   - **Problema:** Faltam entidades e relacionamentos (Video -> Channel).
   - **Solução:** Criar a tabela `videos` com os status definidos e chave estrangeira apontando para a tabela `channels`.

## Veredito

**STATUS: CLEAN**

O plano mitiga todos os gaps. Nenhuma dependência externa bloqueará o fluxo, pois todas as tecnologias serão executadas contêinerizadas no ambiente local, permitindo testes e2e determinísticos em malha fechada.
