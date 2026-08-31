import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Pattern not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after), 'utf8');
}

replaceOnce(
  'src/services/api.ts',
`    if (directRes.ok) {
      console.log("Direct browser-to-Obsidian connection succeeded!");
      const data = await directRes.json().catch(() => ({}));
      useDirectClientSideFetch = true;
      return {
        res: { ok: true, status: 200 } as Response,
        data: { success: true, message: "Conectado diretamente pelo navegador.", ...data },
      };
    } else {
      useDirectClientSideFetch = true;
      const data = await directRes.json().catch(() => ({}));
      return {
        res: directRes,
        data: { success: false, message: \`Obsidian respondeu com status HTTP \${directRes.status}. Verifique o token/chave de autenticação.\`, ...data },
      };
    }
`,
`    const data = await directRes.json().catch(() => ({}));
    useDirectClientSideFetch = true;
    if (directRes.ok && data?.authenticated === true) {
      console.log("Direct browser-to-Obsidian authenticated connection succeeded!");
      return {
        res: { ok: true, status: 200 } as Response,
        data: { success: true, message: "Conectado e autenticado no Obsidian Local REST API.", ...data },
      };
    }
    if (directRes.ok && data?.authenticated === false) {
      return {
        res: { ok: false, status: 401 } as Response,
        data: {
          success: false,
          status: 401,
          message: "O Local REST API respondeu, mas a API Key não autenticou. Copie novamente a chave exibida no plugin do Obsidian.",
          ...data,
        },
      };
    }
    return {
      res: directRes,
      data: { success: false, message: \`Obsidian respondeu com status HTTP \${directRes.status}. Verifique o token/chave de autenticação.\`, ...data },
    };
`
);

replaceOnce(
  'server.ts',
`      const response = await fetch(\`\${parsedUrl.protocol}//\${parsedUrl.host}/\`, {
        method: "GET",
        headers: { Authorization: \`Bearer \${finalApiKey}\`, Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.ok) return res.json({ success: true, message: "Conectado com sucesso ao Obsidian Local REST API." });
      return res.json({ success: false, status: response.status, message: \`Obsidian REST API retornou HTTP \${response.status}\` });
`,
`      const response = await fetch(\`\${parsedUrl.protocol}//\${parsedUrl.host}/\`, {
        method: "GET",
        headers: { Authorization: \`Bearer \${finalApiKey}\`, Accept: "application/json" },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.authenticated === true) {
        return res.json({ success: true, message: "Conectado e autenticado com sucesso ao Obsidian Local REST API." });
      }
      if (response.ok && payload?.authenticated === false) {
        return res.json({ success: false, status: 401, message: "O Local REST API respondeu, mas a API Key não autenticou." });
      }
      return res.json({ success: false, status: response.status, message: \`Obsidian REST API retornou HTTP \${response.status}\` });
`
);

fs.writeFileSync(
  'tests/obsidianConnectionAuthContract.test.ts',
`import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

describe("Obsidian connection authentication contract", () => {
  test("renderer requires authenticated=true instead of accepting HTTP 200 alone", () => {
    const source = readFileSync("src/services/api.ts", "utf8");
    expect(source).toContain("directRes.ok && data?.authenticated === true");
    expect(source).toContain("directRes.ok && data?.authenticated === false");
    expect(source).toContain("API Key não autenticou");
  });

  test("backend connection probe also requires authenticated=true", () => {
    const source = readFileSync("server.ts", "utf8");
    expect(source).toContain("response.ok && payload?.authenticated === true");
    expect(source).toContain("response.ok && payload?.authenticated === false");
  });
});
`,
  'utf8'
);
