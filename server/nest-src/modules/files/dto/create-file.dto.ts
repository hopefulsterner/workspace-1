import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFileDto {
  @ApiProperty({ example: 'project-uuid' })
  @IsString()
  projectId: string;

  @ApiProperty({ example: '/src/components/Button.tsx' })
  @IsString()
  path: string;

  @ApiProperty({ example: 'Button.tsx' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'export const Button = () => {}' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ enum: ['FILE', 'FOLDER'], default: 'FILE' })
  @IsEnum(['FILE', 'FOLDER'])
  @IsOptional()
  type?: 'FILE' | 'FOLDER';
}
