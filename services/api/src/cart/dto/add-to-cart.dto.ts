import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID to add to cart' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID (optional)' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  quantity: number;
}
