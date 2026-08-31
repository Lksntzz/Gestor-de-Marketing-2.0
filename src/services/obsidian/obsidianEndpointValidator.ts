/**
 * obsidianEndpointValidator.ts
 *
 * Módulo centralizado de validação de segurança e defesa anti-SSRF
 * para conexões com o Obsidian Local REST API.
 */

const ALLOWED_LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);

// Lista de portas locais estritamente permitidas para o Obsidian Local REST API
const ALLOWED_OBSIDIAN_PORTS = new Set([27123, 27124]);

const ALLOWED_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

const ALLOWED_FORWARD_HEADERS = new Set([
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "accept-encoding",
  "content-length"
]);

export interface ValidatedObsidianEndpoint {
  url: URL;
  protocol: string;
  host: string;
  hostname: string;
  port: number;
}

/**
 * Valida estritamente se uma URL de endpoint aponta exclusivamente para o Obsidian Local REST API
 * rodando em interface loopback na mesma máquina, bloqueando SSRF, domínios externos e portas sensíveis.
 */
export function parseLoopbackEndpoint(endpoint: string): URL {
  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("Endpoint do Obsidian não informado.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpoint.trim());
  } catch {
    throw new Error("URL do endpoint Obsidian inválida.");
  }

  // 1. Validação de Protocolo
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Protocolo do Obsidian inválido. Apenas HTTP e HTTPS são permitidos.");
  }

  // 2. Não permitir credenciais embutidas na URL
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Credenciais embutidas na URL do Obsidian não são permitidas.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 3. Validação Estrita de Host (apenas 127.0.0.1, localhost, ::1)
  // Rejeita explicitamente 0.0.0.0, local.obsidian.md e subdomínios .localhost
  if (!ALLOWED_LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `SSRF Bloqueado: O host '${hostname}' não é permitido. Apenas o Obsidian Local REST API em loopback estrito (127.0.0.1 ou localhost) é autorizado.`
    );
  }

  // 4. Validação de Porta (Strict Allowlist para o plugin Obsidian Local REST API)
  const portStr = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");
  const portNum = parseInt(portStr, 10);

  if (Number.isNaN(portNum) || !ALLOWED_OBSIDIAN_PORTS.has(portNum)) {
    throw new Error(`SSRF Bloqueado: A porta '${portStr}' não é autorizada. Apenas as portas padrão do Obsidian Local REST API (27123 ou 27124) são permitidas.`);
  }

  return parsedUrl;
}

/**
 * Valida e sanitiza o caminho do endpoint no Obsidian REST API,
 * prevenindo Path Traversal e limitando às rotas oficiais do plugin.
 */
export function validateObsidianProxyPath(targetPath: string): string {
  const raw = String(targetPath || "/").trim();
  
  if (raw.includes("..") || raw.includes("\\") || raw.includes("%2e%2e") || raw.includes("%2E%2E")) {
    throw new Error("Path traversal detectado no caminho do Obsidian.");
  }

  const normalized = raw.startsWith("/") ? raw : `/${raw}`;

  // Permitir raiz (status check), /vault, /active, /open, /search, /commands, /periodic
  const isAllowedRoute =
    normalized === "/" ||
    normalized.startsWith("/vault") ||
    normalized.startsWith("/active/") ||
    normalized.startsWith("/open/") ||
    normalized.startsWith("/search/") ||
    normalized.startsWith("/commands/") ||
    normalized.startsWith("/periodic/");

  if (!isAllowedRoute) {
    throw new Error(`Rota '${normalized}' não é uma rota autorizada do Obsidian Local REST API.`);
  }

  return normalized;
}

/**
 * Valida o método HTTP para o proxy do Obsidian.
 */
export function validateObsidianProxyMethod(method: string): string {
  const normalized = String(method || "GET").trim().toUpperCase();
  if (!ALLOWED_HTTP_METHODS.has(normalized)) {
    throw new Error(`Método HTTP '${method}' não suportado para o proxy do Obsidian.`);
  }
  return normalized;
}

/**
 * Sanitiza cabeçalhos encaminhados para o Obsidian.
 * Garante que customHeaders não sobrescreva Authorization, Host ou Content-Type crítico.
 */
export function sanitizeObsidianForwardHeaders(
  customHeaders: Record<string, unknown> | undefined,
  apiKey: string
): Record<string, string> {
  const safeHeaders: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
  };

  if (customHeaders && typeof customHeaders === "object") {
    for (const [key, value] of Object.entries(customHeaders)) {
      const lowerKey = key.toLowerCase().trim();
      if (ALLOWED_FORWARD_HEADERS.has(lowerKey) && typeof value === "string") {
        safeHeaders[key] = value;
      }
    }
  }

  // Authorization e Bearer token do servidor SEMPRE sobrescrevem qualquer tentativa de injeção
  safeHeaders["Authorization"] = `Bearer ${apiKey.trim()}`;

  return safeHeaders;
}
