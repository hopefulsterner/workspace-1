import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Awesome Project', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'A brief description of the project' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'react', description: 'Template to use (react, node, etc.)' })
  @IsString()
  @IsOptional()
  template?: string;
}
