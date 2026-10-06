export interface RfqBucket {
  get(key: string): Promise<{ body: BodyInit; json(): Promise<unknown> } | null>;
  put(key: string, value: string | ArrayBuffer, options?: unknown): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; limit: number }): Promise<{ objects: { key: string }[] }>;
}
export interface RfqEnv {
  RFQ_STORAGE?: RfqBucket;
  RESEND_API_KEY?: string;
  RFQ_FROM?: string;
}
export function handleRfq(request: Request, env: RfqEnv, send?: typeof fetch): Promise<Response | null>;
export function retryRfq(env: RfqEnv, send?: typeof fetch): Promise<void>;
