import { IsInt, IsObject, Min } from 'class-validator';

export class GenerateReportDto {
  @IsInt()
  @Min(1)
  templateId!: number;

  @IsObject()
  params!: Record<string, unknown>;
}
