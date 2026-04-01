type StartedServer = {
  close: () => Promise<void>;
};

const serverRegistry = new Map<string, StartedServer>();

function normalizeWorkerId(raw: string | undefined) {
  const parsed = Number(raw ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function allocateIntegrationPort(suiteKey: string) {
  const workerId = normalizeWorkerId(process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID);
  const suiteOffset = Array.from(suiteKey).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 200;
  return 3600 + workerId * 200 + suiteOffset;
}

export async function startIntegrationServer(suiteKey: string) {
  const existing = serverRegistry.get(suiteKey);
  if (existing) return existing;

  process.env.API_PORT = String(allocateIntegrationPort(suiteKey));
  const mod = await import("../server.js");
  const started: StartedServer = { close: async () => { await mod.app.close(); } };
  serverRegistry.set(suiteKey, started);
  return started;
}

export async function stopIntegrationServer(suiteKey: string) {
  const existing = serverRegistry.get(suiteKey);
  if (!existing) return;
  serverRegistry.delete(suiteKey);
  await existing.close();
}
