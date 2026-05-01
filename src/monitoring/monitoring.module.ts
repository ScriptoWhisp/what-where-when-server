import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { WsMetricsInterceptor } from './ws-metrics.interceptor';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    WsMetricsInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [WsMetricsInterceptor],
})
export class MonitoringModule {}

