import { IsUUID, IsString, IsNumber, IsInt, Min } from 'class-validator';

export class CalculatePriceDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  technique: string;

  @IsString()
  destinationCountry: string;
}
