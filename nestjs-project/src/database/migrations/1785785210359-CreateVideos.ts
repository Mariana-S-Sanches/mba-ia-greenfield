import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideos1785785210359 implements MigrationInterface {
  name = 'CreateVideos1785785210359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."videos_status_enum" AS ENUM('DRAFT', 'PROCESSING', 'READY', 'ERROR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referenceId" character varying(21) NOT NULL, "title" character varying(100) NOT NULL, "description" text, "status" "public"."videos_status_enum" NOT NULL DEFAULT 'DRAFT', "channelId" uuid NOT NULL, "uploadId" character varying, "fileKey" character varying, "thumbnailKey" character varying, "duration" integer, "resolution" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_740fe497c0d8b188b44a6361dc2" UNIQUE ("referenceId"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_16909a0ae1ace805503fe874dde" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_16909a0ae1ace805503fe874dde"`,
    );
    await queryRunner.query(`DROP TABLE "videos"`);
    await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
  }
}
