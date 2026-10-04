import type { Response } from 'express';

export function openEventStream(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Evita que proxies como o nginx guardem a resposta antes de enviá-la.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}