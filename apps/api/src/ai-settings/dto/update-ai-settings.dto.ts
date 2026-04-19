import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  chatModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  imageModel?: string;

  @IsOptional()
  @IsBoolean()
  mockEnabled?: boolean;

  /** Empty string or omitted = do not change stored key */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  apiKey?: string;
}

export class TestChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  chatModel?: string;

  @IsOptional()
  @IsBoolean()
  mockEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  apiKey?: string;
}
