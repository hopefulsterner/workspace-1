import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFileDto {
  @ApiPropertyOptional({ example: 'Updated file content' })
  @IsString()
  @IsOptional()
  content?: string;
}
