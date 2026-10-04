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

export const env = {
  port: readPort(process.env['PORT']),
  clientOrigin: process.env['CLIENT_ORIGIN'] ?? DEFAULT_CLIENT_ORIGIN,
} as const;