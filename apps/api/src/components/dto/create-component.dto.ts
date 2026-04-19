import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateComponentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['TEXT', 'IMAGE'])
  type!: 'TEXT' | 'IMAGE';

  @IsOptional()
  @IsString()
  defaultScript?: string;

  @IsOptional()
  @IsString()
  defaultConfig?: string;
}
