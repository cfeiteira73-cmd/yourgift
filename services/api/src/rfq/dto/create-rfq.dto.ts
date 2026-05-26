import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RfqItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  productName: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specifications?: string;
}

export class CreateRfqDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Wallet ID associated with this RFQ (EmployeeWallet)' })
  @IsUUID()
  walletId: string;

  @ApiProperty({ description: 'Company ID issuing the RFQ' })
  @IsUUID()
  companyId: string;

  @ApiProperty({ description: 'Email of the employee/buyer creating the RFQ' })
  @IsString()
  employeeEmail: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetBudget?: number;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Must be a future date' })
  @IsDateString()
  deadline: string;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 20 })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  supplierIds: string[];

  @ApiProperty({ type: [RfqItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RfqItemDto)
  items: RfqItemDto[];

  @ApiPropertyOptional({ type: [String], description: 'S3 URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
