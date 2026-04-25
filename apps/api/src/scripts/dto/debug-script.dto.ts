import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class DebugScriptDto {
  @IsIn(['TEXT', 'IMAGE', 'CHART'])
  elementType!: 'TEXT' | 'IMAGE' | 'CHART';

  @IsString()
  @MaxLength(200_000)
  script!: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
