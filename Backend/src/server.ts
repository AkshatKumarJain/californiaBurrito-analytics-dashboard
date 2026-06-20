import { env } from "./config/env";
import { createApp } from "./app";

export async function startServer(): Promise<void> {
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Analytics API listening on port ${env.port}`);
  });
}
