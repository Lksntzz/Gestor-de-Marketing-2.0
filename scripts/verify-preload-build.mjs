import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const preloadPath = path.resolve("dist/preload.cjs");

try {
  await stat(preloadPath);
} catch {
  throw new Error(`Preload compilado não encontrado: ${preloadPath}`);
}

const source = await readFile(preloadPath, "utf8");

const requiredSnippets = [
  'require("electron")',
  'exposeInMainWorld("electronAPI"',
  'update:get-status',
  'update:check',
  'update:install',
  'update:status',
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Preload inválido: trecho obrigatório ausente: ${snippet}`);
  }
}

if (source.includes("node_modules/electron/index.js")) {
  throw new Error("Preload inválido: o pacote npm electron foi incorporado ao bundle. O módulo electron deve permanecer external.");
}

console.log("Preload bridge OK: Electron externalizado e IPC de atualização presente.");
