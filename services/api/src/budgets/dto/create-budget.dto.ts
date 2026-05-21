import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBudgetDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ['monthly', 'quarterly', 'yearly', 'custom'] })
  @IsEnum(['monthly', 'quarterly', 'yearly', 'custom'])
  period: string;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  limitAmount: number;

  @ApiPropertyOptional({ description: 'Alert threshold 0–1 (default 0.8 = 80%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  alertThreshold?: number;
}
