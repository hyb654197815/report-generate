import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ScriptsModule } from '../scripts/scripts.module';
import { ConvertModule } from '../convert/convert.module';

@Module({
  imports: [ScriptsModule, ConvertModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
