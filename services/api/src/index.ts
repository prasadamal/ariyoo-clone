import http from 'http';
import { loadConfig } from './config';
import { prisma } from './prisma';
import { createApp } from './app';
import { attachRealtime } from './realtime';

const config = loadConfig();
const server = http.createServer();
const realtime = attachRealtime(server, prisma, config);
server.on('request', createApp({ db: prisma, config, publish: realtime.publish }));

server.listen(config.port, () => {
  console.log(`API listening on :${config.port} (${config.env})`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  realtime.io?.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
