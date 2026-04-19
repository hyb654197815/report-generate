import { Module } from '@nestjs/common';
import { ScriptRunnerService } from './script-runner.service';
import { ScriptsDebugController } from './scripts-debug.controller';

@Module({
  controllers: [ScriptsDebugController],
  providers: [ScriptRunnerService],
  exports: [ScriptRunnerService],
})
export class ScriptsModule {}
