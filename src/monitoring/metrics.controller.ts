import { Controller, Get, Header } from '@nestjs/common';
import { registry } from './metrics';

@Controller()
export class MetricsController {
  @Get('/metrics')
  @Header('Content-Type', registry.contentType)
  async metrics(): Promise<string> {
    return registry.metrics();
  }
}

