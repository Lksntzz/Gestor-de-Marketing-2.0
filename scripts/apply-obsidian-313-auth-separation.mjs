import fs from 'node:fs';

const path = 'src/services/api.ts';
let source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('async function verifyObsidianConnection(');
const end = source.indexOf('\nasync function requireVerifiedObsidian', start);
if (start < 0 || end < 0) throw new Error('verifyObsidianConnection block not found');

const replacement = `async function verifyObsidianConnection(
  config: { endpoint: string; apiKey: string },
  _selectVault: boolean,
): Promise<ObsidianConnectionResult> {
  if (!config.endpoint.trim() || !config.apiKey.trim()) {
    stopObsidianHeartbeat();
    await setDesktopObsidianAuthorization(false);
    markObsidianRuntimeDisconnected("Endpoint ou token do Obsidian não configurado.");
    return { success: false, message: "Informe o endpoint e o token do Obsidian Local REST API." };
  }

  const liveConfig: ObsidianApiConfig = {
    ...DEFAULT_API_CONFIG,
    endpoint: normalizeObsidianEndpoint(config.endpoint),
    apiKey: config.apiKey.trim(),
    connectionStatus: "connected",
  };

  let connectionData: any = {};
  try {
    const { res, data } = await requestObsidianConnectionTest(liveConfig);
    connectionData = data || {};
    if (!res.ok || !data?.success) {
      const targetEndpoint = normalizeObsidianEndpoint(config.endpoint);
      const errorMsg = data?.message || "Conexão rejeitada.";
      stopObsidianHeartbeat();
      await setDesktopObsidianAuthorization(false);
      markObsidianRuntimeDisconnected(errorMsg);
      return {
        success: false,
        message: "Não foi possível conectar ao Obsidian local (" + targetEndpoint + "). Verifique se o Obsidian está aberto, o Local REST API está ativo e a API Key está correta. Detalhes: " + errorMsg,
      };
    }
  } catch (err: any) {
    stopObsidianHeartbeat();
    await setDesktopObsidianAuthorization(false);
    const message = err?.message || "Não foi possível autenticar no Obsidian Local REST API.";
    markObsidianRuntimeDisconnected(message);
    return { success: false, message };
  }

  // Authentication is the connection boundary. Subsequent Base preparation is
  // operational synchronization and must never revoke a valid authenticated session.
  await setDesktopObsidianAuthorization(true);
  markObsidianRuntimeConnected();
  startObsidianHeartbeat(liveConfig);

  let createdFolders = 0;
  let triageMoved = 0;
  let snapshot = { notes: 0, folders: NISTI_KNOWLEDGE_FOLDERS.length };
  const preparationWarnings: string[] = [];

  try {
    const structure = await ensureNistiRemoteStructure(liveConfig);
    createdFolders = structure.createdFolders.length;
  } catch (err: any) {
    const message = err?.message || "estrutura automática indisponível";
    preparationWarnings.push("estrutura: " + message);
    console.warn("Obsidian authenticated, but Nisti structure preparation failed:", err);
  }

  try {
    const triage = await triageNistiInbox(liveConfig);
    triageMoved = triage.moved.length;
  } catch (err: any) {
    const message = err?.message || "triagem automática indisponível";
    preparationWarnings.push("triagem: " + message);
    console.warn("Obsidian authenticated, but Inbox triage failed:", err);
  }

  try {
    snapshot = await publishCurrentDesktopVaultSnapshot([...NISTI_KNOWLEDGE_FOLDERS], liveConfig);
  } catch (err: any) {
    const message = err?.message || "sincronização inicial indisponível";
    preparationWarnings.push("sincronização: " + message);
    console.warn("Obsidian authenticated, but initial snapshot failed:", err);
  }

  const detectedVault = String(connectionData.vault || connectionData.name || "Vault ativo");
  const createdText = createdFolders
    ? " " + createdFolders + " pastas foram criadas automaticamente."
    : "";
  const triageText = triageMoved ? " " + triageMoved + " nova(s) nota(s) foram classificadas." : "";
  const warningText = preparationWarnings.length
    ? " Conexão autenticada; algumas etapas da Base precisam ser repetidas: " + preparationWarnings.join(" | ")
    : " Estrutura e sincronização inicial concluídas.";

  return {
    success: true,
    detectedVaultName: detectedVault,
    localNotesFound: snapshot.notes,
    localFoldersFound: NISTI_KNOWLEDGE_FOLDERS.length,
    localFolders: [...NISTI_KNOWLEDGE_FOLDERS],
    message: "Obsidian conectado e autenticado." + createdText + triageText + warningText,
  };
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source, 'utf8');

const testPath = 'tests/obsidianRuntimeStability.test.ts';
let tests = fs.readFileSync(testPath, 'utf8');
const marker = `  test("heartbeat is lightweight and tolerates transient failures", () => {`;
if (!tests.includes(marker)) throw new Error('test insertion marker not found');
const testCase = `  test("authenticated transport is not revoked by Base preparation failures", () => {\n    const source = normalize(readFileSync("src/services/api.ts", "utf8"));\n    const start = source.indexOf("async function verifyObsidianConnection");\n    const end = source.indexOf("async function requireVerifiedObsidian", start);\n    const block = source.slice(start, end);\n    const authBoundary = block.indexOf("markObsidianRuntimeConnected()");\n    const preparationBoundary = block.indexOf("ensureNistiRemoteStructure", authBoundary);\n    expect(authBoundary).toBeGreaterThan(-1);\n    expect(preparationBoundary).toBeGreaterThan(authBoundary);\n    expect(block.slice(preparationBoundary)).not.toContain("markObsidianRuntimeDisconnected");\n    expect(block).toContain("preparationWarnings");\n  });\n\n`;
tests = tests.replace(marker, testCase + marker);
fs.writeFileSync(testPath, tests, 'utf8');
