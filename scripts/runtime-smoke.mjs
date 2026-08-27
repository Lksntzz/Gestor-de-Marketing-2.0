import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";

const HOST = "127.0.0.1";

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => err ? reject(err) : port ? resolve(port) : reject(new Error("Porta de smoke inválida.")));
    });
  });
}

async function waitForHealth(baseUrl, instanceId, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "backend indisponível";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data?.runtime === "nisti-secure-local" && data?.instanceId === instanceId) return data;
      lastError = `health inesperado: HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Backend empacotado não ficou saudável: ${lastError}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  const exitPromise = once(child, "exit").catch(() => undefined);
  child.kill();
  await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

async function run() {
  const workspace = await mkdtemp(path.join(tmpdir(), "nisti-runtime-smoke-"));
  const isolatedDist = path.join(workspace, "dist");
  let child;

  try {
    await cp(path.resolve("dist"), isolatedDist, { recursive: true });
    const port = await reservePort();
    const instanceId = `smoke-${Date.now()}`;
    const baseUrl = `http://${HOST}:${port}`;

    child = spawn(process.execPath, [path.join(isolatedDist, "server.cjs")], {
      cwd: workspace,
      env: {
        ...process.env,
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
        NISTI_APP_PORT: String(port),
        NISTI_INSTANCE_ID: instanceId,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk).slice(0, 8_000);
    });

    await waitForHealth(baseUrl, instanceId);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, { cache: "no-store" });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || !session?.token) throw new Error("Handshake de sessão do backend falhou.");

    const ingestionResponse = await fetch(`${baseUrl}/api/gemini/process-knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-session-token": session.token,
      },
      body: JSON.stringify({
        type: "text",
        engineMode: "local",
        payload: {
          title: "Runtime Smoke",
          text: "Fonte de teste empacotada. Nenhuma afirmação externa deve ser adicionada.",
        },
      }),
    });
    const ingestion = await ingestionResponse.json();
    if (!ingestionResponse.ok || !ingestion?.success || !ingestion?.data?.content?.includes("Fonte de teste empacotada")) {
      throw new Error(`Ingestão autenticada falhou: HTTP ${ingestionResponse.status}`);
    }

    console.log("Runtime smoke OK: backend self-contained, sessão local e ingestão autenticada validados.");
  } catch (err) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      console.error(`Backend encerrou com código ${child.exitCode}.`);
    }
    throw err;
  } finally {
    await stopChild(child);
    await rm(workspace, {
      recursive: true,
      force: true,
      maxRetries: process.platform === "win32" ? 8 : 2,
      retryDelay: 250,
    });
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
