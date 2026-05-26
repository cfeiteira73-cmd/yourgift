import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsObject,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'The internal tenant ID that owns this subscription',
    example: 'tenant_abc123',
  })
  @IsString()
  @MinLength(1)
  tenantId: string;

  @ApiProperty({
    description:
      'The customer identifier (internal customer ID or email). ' +
      'A Stripe customer will be created or retrieved for this value.',
    example: 'customer_xyz789',
  })
  @IsString()
  @MinLength(1)
  customerId: string;

  @ApiProperty({
    description: 'Internal plan identifier (e.g. "starter", "growth", "enterprise")',
    example: 'growth',
  })
  @IsString()
  @MinLength(1)
  planId: string;

  @ApiProperty({
    description: 'The Stripe Price ID to subscribe to',
    example: 'price_1OqXXXXXXXXXXXXX',
  })
  @IsString()
  @MinLength(1)
  priceId: string;

  @ApiPropertyOptional({
    description: 'Number of trial days before billing begins. 0 or omitted means no trial.',
    example: 14,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({
    description: 'Arbitrary key-value metadata to attach to the Stripe subscription',
    example: { plan_source: 'sales_demo', campaign: 'q2-2026' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
