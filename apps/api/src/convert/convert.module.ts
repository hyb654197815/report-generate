import { Module } from '@nestjs/common';
import { GotenbergService } from './gotenberg.service';

@Module({
  providers: [GotenbergService],
  exports: [GotenbergService],
})
export class ConvertModule {}
