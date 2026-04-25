import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { POSITION_PPM } from '../../lib/pdf-rect';

export class PositionDto {
  @IsInt()
  @Min(1)
  page!: number;

  @IsNumber()
  @Min(0)
  x!: number;

  @IsNumber()
  @Min(0)
  y!: number;

  @IsNumber()
  @Min(0)
  w!: number;

  @IsNumber()
  @Min(0)
  h!: number;

  /** 0..POSITION_PPM — 与 x 相同含义的整数万分比，优先用于生成。 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(POSITION_PPM)
  xp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(POSITION_PPM)
  yp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(POSITION_PPM)
  wp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(POSITION_PPM)
  hp?: number;
}

export class ElementInputDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsInt()
  componentId?: number | null;

  @IsString()
  elementType!: 'TEXT' | 'IMAGE' | 'CHART';

  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;

  @IsOptional()
  @IsString()
  scriptCode?: string;

  @IsOptional()
  @IsString()
  staticContent?: string;

  @IsOptional()
  @IsString()
  styleConfig?: string;
}

export class SaveElementsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ElementInputDto)
  elements!: ElementInputDto[];
}
