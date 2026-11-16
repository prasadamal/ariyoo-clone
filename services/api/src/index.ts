import { createServer } from './app.js';
import { config } from './config.js';
import { prisma } from './prisma.js';
const { server, io } = createServer();
server.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  io.close();
  server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
