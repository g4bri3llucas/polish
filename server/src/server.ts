import { createApp } from './app';
import { env } from './config/env';
import { GeminiClient } from './services/geminiClient';

const llmClient = new GeminiClient(env.llmApiKey, env.llmModel);
const app = createApp({ llmClient });

const server = app.listen(env.port, () => {
  console.log(`Servidor rodando em http://localhost:${env.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} recebido. Encerrando o servidor...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));