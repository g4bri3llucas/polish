import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import type { LlmClient, LlmGenerateParams } from '../services/llmClient';

export const VALID_RESUME =
  'Maria Souza. Desenvolvedora front-end com 2 anos de experiência em Angular e TypeScript.';

export interface RunningApp {
  baseUrl: string;
  close: () => Promise<void>;
}


export async function startApp(llmClient: LlmClient): Promise<RunningApp> {
  const server = createApp({ llmClient }).listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
  };
}

export interface FakeLlm extends LlmClient {
  generateCalls: LlmGenerateParams[];
  streamCalls: LlmGenerateParams[];
}

export interface FakeLlmBehavior {
  generate?: (params: LlmGenerateParams) => Promise<string>;
  generateStream?: (params: LlmGenerateParams) => AsyncIterable<string>;
}

// Um LlmClient falso que anota como foi chamado.
export function createFakeLlm(behavior: FakeLlmBehavior = {}): FakeLlm {
  const generateCalls: LlmGenerateParams[] = [];
  const streamCalls: LlmGenerateParams[] = [];

  return {
    generateCalls,
    streamCalls,
    generate(params) {
      generateCalls.push(params);
      return behavior.generate?.(params) ?? Promise.resolve('## Nota\n**70/100** — ok');
    },
    generateStream(params) {
      streamCalls.push(params);
      return behavior.generateStream?.(params) ?? chunksOf('Olá', ' mundo');
    },
  };
}

export async function* chunksOf(...chunks: string[]): AsyncGenerator<string> {
  await Promise.resolve();
  for (const chunk of chunks) {
    yield chunk;
  }
}

export interface SseEvent {
  event: string;
  data: unknown;
}


export async function readSseEvents(response: Response): Promise<SseEvent[]> {
  const text = await response.text();

  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((line) => line.startsWith('event: '))?.slice(7) ?? '';
      const data = lines.find((line) => line.startsWith('data: '))?.slice(6) ?? 'null';

      return { event, data: JSON.parse(data) as unknown };
    });
}

export function postJson(baseUrl: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}