import { Injectable } from '@nestjs/common';
import EventEmitter2 from 'eventemitter2';

@Injectable()
export class EventBusService extends EventEmitter2 {
  constructor() {
    super({ wildcard: true, maxListeners: 50 });
  }
}
