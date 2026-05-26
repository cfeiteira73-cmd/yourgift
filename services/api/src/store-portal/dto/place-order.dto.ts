import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PlaceOrderDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  @Max(200)
  quantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
