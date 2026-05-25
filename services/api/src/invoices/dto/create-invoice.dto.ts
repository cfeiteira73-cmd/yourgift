import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceLineItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @IsPositive()
  total: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Order ID this invoice is linked to' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Supplier ID issuing the invoice' })
  @IsUUID()
  supplierId: string;

  @ApiProperty({ description: 'Invoice number from supplier' })
  @IsString()
  invoiceNumber: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Payment due date (ISO 8601)' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Tenant ID for multi-tenant isolation' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
