import { IsArray, IsObject, ValidateNested, IsString, IsNumber, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

class AddressDto {
  @IsString() name: string;
  @IsString() street: string;
  @IsString() city: string;
  @IsString() postalCode: string;
  @IsString() country: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;
}
