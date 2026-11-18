import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main() {
  const config = loadConfig();
  const app = buildApp({ config });

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    console.log(`\n======================================================`);
    console.log(`🚀 OmniRouter Gateway active on ${address}`);
    console.log(`📡 OpenAI-Compatible API: ${address}/v1`);
    console.log(`🩺 Health check: ${address}/health`);
    console.log(`🔐 Gateway Auth: ${config.GATEWAY_KEY ? "Enabled" : "Disabled (Local dev mode)"}`);
    console.log(`======================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
