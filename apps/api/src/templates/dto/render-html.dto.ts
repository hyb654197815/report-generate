import { IsString, MinLength } from 'class-validator';

export class RenderHtmlDto {
  @IsString()
  @MinLength(1)
  html!: string;
}
