import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFulfillmentDto {
  @ApiProperty({ description: 'Order ID to begin fulfillment for' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Supplier ID responsible for fulfillment' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ description: 'Carrier tracking number' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Carrier name e.g. DHL, UPS, CTT' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ description: 'Estimated delivery date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  estimatedDelivery?: string;

  @ApiPropertyOptional({ description: 'Internal warehouse notes' })
  @IsOptional()
  @IsString()
  warehouseNotes?: string;
}
