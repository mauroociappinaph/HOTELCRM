import { Module, Global, Logger } from '@nestjs/common';

import { MonitoringService } from './monitoring.service';

@Global()
@Module({
  providers: [MonitoringService, Logger],
  exports: [MonitoringService],
})
export class MonitoringModule {}
