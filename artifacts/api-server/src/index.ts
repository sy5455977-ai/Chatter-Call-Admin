import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./lib/wsServer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

async function main() {
  await setupWebSocketServer(server);
  server.listen(port, () => {
    logger.info({ port }, "Server listening (HTTP + WebSocket)");
  });
}

main().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
