import { IsString, IsNotEmpty, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PartDto {
  @IsString()
  @IsNotEmpty()
  ETag: string;

  @IsInt()
  @Min(1)
  PartNumber: number;
}

export class CompleteUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartDto)
  parts: PartDto[];
}
