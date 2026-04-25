import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateComponentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['TEXT', 'IMAGE', 'CHART'])
  type!: 'TEXT' | 'IMAGE' | 'CHART';

  @IsOptional()
  @IsString()
  defaultScript?: string;

  @IsOptional()
  @IsString()
  defaultConfig?: string;
}
