import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
  ],
  registers: [registry],
});

export const wsConnections = new Gauge({
  name: 'ws_connections',
  help: 'Current number of active websocket connections (Socket.IO namespace)',
  labelNames: ['namespace'] as const,
  registers: [registry],
});

export const wsEventsReceivedTotal = new Counter({
  name: 'ws_events_received_total',
  help: 'Total number of websocket events received by the server',
  labelNames: ['event'] as const,
  registers: [registry],
});

export const wsEventsSentTotal = new Counter({
  name: 'ws_events_sent_total',
  help: 'Total number of websocket events emitted by the server',
  labelNames: ['event'] as const,
  registers: [registry],
});

export const wsHandlerDurationSeconds = new Histogram({
  name: 'ws_handler_duration_seconds',
  help: 'Websocket handler duration in seconds',
  labelNames: ['event'] as const,
  buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const wsErrorsTotal = new Counter({
  name: 'ws_errors_total',
  help: 'Total number of websocket errors surfaced to WsExceptionsFilter',
  labelNames: ['event', 'type'] as const,
  registers: [registry],
});

export function normalizeRoute(path: string | undefined): string {
  if (!path) return 'unknown';
  const noQuery = path.split('?')[0] ?? path;
  return noQuery.replace(/\/\d+(?=\/|$)/g, '/:id');
}

