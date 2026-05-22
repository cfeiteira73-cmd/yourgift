import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';

// EventBusModule is @Global() — EventBusService is already available app-wide.
// ConfigModule is forRoot({ isGlobal: true }) — ConfigService is auto-injected.

@Module({
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
