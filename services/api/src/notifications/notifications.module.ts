import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

// EventBusModule is @Global() — EventBusService is already available app-wide.
// ConfigModule is forRoot({ isGlobal: true }) — ConfigService is auto-injected.

@Module({
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
