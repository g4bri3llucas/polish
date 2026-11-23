import 'dotenv/config';

const DEFAULT_PORT = 3000;
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:4200';

function readPort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT inválida: "${value}". Use um número inteiro entre 1 e 65535.`,
    );
  }

  return port;
}

function readTrustProxy(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 0;
  }

  const hops = Number(value);

  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(
      `TRUST_PROXY inválido: "${value}". Use 0 (sem proxy) ou o número de proxies na frente do servidor.`,
    );
  }

  return hops;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value === '') {
    throw new Error(
      `Variável de ambiente ${name} não definida. ` +
        'Copie server/.env.example para server/.env e preencha os valores.',
    );
  }

  return value;
}

export const env = {
  port: readPort(process.env['PORT']),
  clientOrigin: process.env['CLIENT_ORIGIN'] ?? DEFAULT_CLIENT_ORIGIN,
  trustProxy: readTrustProxy(process.env['TRUST_PROXY']),
  llmApiKey: requireEnv('LLM_API_KEY'),
  llmModel: requireEnv('LLM_MODEL'),
} as const;