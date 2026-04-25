import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateComponentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['TEXT', 'IMAGE', 'CHART'])
  type?: 'TEXT' | 'IMAGE' | 'CHART';

  @IsOptional()
  @IsString()
  defaultScript?: string;

  @IsOptional()
  @IsString()
  defaultConfig?: string;
}
