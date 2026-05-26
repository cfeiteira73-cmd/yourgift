import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRefundDto {
  @ApiProperty({
    description: 'The ID of the order to refund',
    example: 'clx1234abcdef',
  })
  @IsString()
  @MinLength(1)
  orderId: string;

  @ApiPropertyOptional({
    description:
      'Refund amount in EUR. If omitted, the full order total is refunded.',
    example: 49.99,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Human-readable reason for the refund',
    example: 'Customer dissatisfied with print quality',
    maxLength: 512,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reason?: string;

  @ApiPropertyOptional({
    description: 'ID of the staff member or system initiating the refund',
    example: 'admin_user_id',
  })
  @IsOptional()
  @IsString()
  refundedBy?: string;
}
