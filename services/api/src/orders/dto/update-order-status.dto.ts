import { IsIn, IsOptional, IsString } from 'class-validator';
import { ORDER_STATUSES, OrderStatus } from '../order-state-machine';

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  actorId?: string;
}
