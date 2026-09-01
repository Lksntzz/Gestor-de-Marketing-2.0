import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Pattern not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after), 'utf8');
}

// Desktop must never try to authenticate directly with the secure-storage sentinel.
replaceOnce(
  'src/services/api.ts',
  `  // 1. Try direct browser fetch first!\n  try {\n`,
  `  // 1. Browser mode can call Obsidian directly after the user accepts the local certificate.\n  // Desktop intentionally routes through the trusted local backend so the renderer never\n  // needs the decrypted API key from secure storage.\n  if (!window.electronAPI) {\n    try {\n`
);

replaceOnce(
  'src/services/api.ts',
  `  } catch (err) {\n    console.warn("Direct browser-to-Obsidian connection failed.", err);\n  }\n\n  // 2. In Web mode with loopback (127.0.0.1 / localhost), Cloud backend cannot reach local PC\n`,
  `    } catch (err) {\n      console.warn("Direct browser-to-Obsidian connection failed.", err);\n    }\n  }\n\n  // 2. In Web mode with loopback (127.0.0.1 / localhost), Cloud backend cannot reach local PC\n`
);

replaceOnce(
  'src/services/api.ts',
  `  if (!window.electronAPI || useDirectClientSideFetch) {\n`,
  `  if (!window.electronAPI) {\n`
);

// Backend performs loopback-only HTTPS requests and contains the real secret.
replaceOnce(
  'server.ts',
  `import crypto from "crypto";\n`,
  `import crypto from "crypto";\nimport http from "http";\nimport https from "https";\n`
);

const helperMarker = `const app = express();\n`;
const helper = `type ObsidianLoopbackResponse = {\n  ok: boolean;\n  status: number;\n  headers: { get(name: string): string | null };\n  json(): Promise<any>;\n  text(): Promise<string>;\n};\n\nfunction isOfficialObsidianSelfSignedEndpoint(target: URL): boolean {\n  const hostname = target.hostname.toLowerCase();\n  return target.protocol === "https:"\n    && target.port === "27124"\n    && (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1");\n}\n\nasync function requestObsidianLoopback(\n  urlString: string,\n  options: RequestInit,\n  timeoutMs = 4_000,\n): Promise<ObsidianLoopbackResponse> {\n  const target = new URL(urlString);\n  const transport = target.protocol === "https:" ? https : http;\n  const trustOfficialLocalCertificate = isOfficialObsidianSelfSignedEndpoint(target);\n  const headers = (options.headers || {}) as Record<string, string>;\n\n  let requestBody: string | Buffer | undefined;\n  if (typeof options.body === "string") requestBody = options.body;\n  else if (Buffer.isBuffer(options.body)) requestBody = options.body;\n  else if (options.body instanceof Uint8Array) requestBody = Buffer.from(options.body);\n  else if (options.body != null) throw new Error("Payload não suportado na ponte segura do Obsidian.");\n\n  return await new Promise((resolve, reject) => {\n    const request = transport.request(target, {\n      method: String(options.method || "GET"),\n      headers,\n      ...(target.protocol === "https:"\n        ? { rejectUnauthorized: !trustOfficialLocalCertificate }\n        : {}),\n    }, (response) => {\n      const chunks: Buffer[] = [];\n      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));\n      response.on("end", () => {\n        const body = Buffer.concat(chunks).toString("utf8");\n        const status = response.statusCode || 0;\n        resolve({\n          ok: status >= 200 && status < 300,\n          status,\n          headers: {\n            get(name: string) {\n              const value = response.headers[name.toLowerCase()];\n              return Array.isArray(value) ? value.join(", ") : value == null ? null : String(value);\n            },\n          },\n          async json() {\n            return body ? JSON.parse(body) : {};\n          },\n          async text() {\n            return body;\n          },\n        });\n      });\n    });\n\n    request.on("error", reject);\n    request.setTimeout(timeoutMs, () => {\n      request.destroy(new Error("Tempo limite ao contatar o Obsidian Local REST API."));\n    });\n    if (requestBody !== undefined) request.write(requestBody);\n    request.end();\n  });\n}\n\nconst app = express();\n`;
replaceOnce('server.ts', helperMarker, helper);

replaceOnce(
  'server.ts',
  `      const response = await fetch(\`${'${parsedUrl.protocol}'}//${'${parsedUrl.host}'}/\`, {\n        method: "GET",\n        headers: { Authorization: \`Bearer ${'${finalApiKey}'}\`, Accept: "application/json" },\n        signal: controller.signal,\n      });\n`,
  `      const response = await requestObsidianLoopback(\`${'${parsedUrl.protocol}'}//${'${parsedUrl.host}'}/\`, {\n        method: "GET",\n        headers: { Authorization: \`Bearer ${'${finalApiKey}'}\`, Accept: "application/json" },\n      }, 3_500);\n`
);

replaceOnce(
  'server.ts',
  `      const obsidianRes = await fetch(fullUrl, fetchOptions);\n`,
  `      const obsidianRes = await requestObsidianLoopback(fullUrl, fetchOptions, 4_000);\n`
);

fs.writeFileSync(
  'tests/obsidianSecureDesktopRouting.test.ts',
  `import { describe, expect, test } from "bun:test";\nimport { readFileSync } from "fs";\n\ndescribe("Obsidian secure desktop routing", () => {\n  test("desktop routes Obsidian calls through the trusted backend", () => {\n    const source = readFileSync("src/services/api.ts", "utf8");\n    expect(source).toContain("if (!window.electronAPI) {\\n    try {");\n    expect(source).toContain("if (!window.electronAPI) {\\n    try {\\n      const parsedUrl");\n    expect(source).not.toContain("if (!window.electronAPI || useDirectClientSideFetch)");\n  });\n\n  test("backend self-signed exception is restricted to official Obsidian loopback HTTPS", () => {\n    const source = readFileSync("server.ts", "utf8");\n    expect(source).toContain("isOfficialObsidianSelfSignedEndpoint");\n    expect(source).toContain('target.port === "27124"');\n    expect(source).toContain('hostname === "127.0.0.1"');\n    expect(source).toContain('rejectUnauthorized: !trustOfficialLocalCertificate');\n    expect(source).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");\n  });\n\n  test("server uses secure loopback bridge for connection test and proxy", () => {\n    const source = readFileSync("server.ts", "utf8");\n    expect(source).toContain("await requestObsidianLoopback");\n    expect(source).toContain("Conectado e autenticado com sucesso ao Obsidian Local REST API");\n  });\n});\n`,
  'utf8'
);
