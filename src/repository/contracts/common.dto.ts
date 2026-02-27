export type GameId = number;
export type ISODateTime = string;

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export interface ApiError {
  code:
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
