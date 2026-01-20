import { IsString, IsArray, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsString()
  role: 'user' | 'assistant';

  @ApiProperty({ example: 'Create a React counter component' })
  @IsString()
  content: string;
}

export class ChatDto {
  @ApiProperty({ type: [MessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({ enum: ['openai', 'anthropic', 'google', 'cerebras'] })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: 'gpt-4-turbo-preview' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 0.7 })
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ example: 4096 })
  @IsNumber()
  @IsOptional()
  maxTokens?: number;
}
