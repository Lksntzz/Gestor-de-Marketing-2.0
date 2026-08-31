import fs from "node:fs";

const path = "tests-node/multiAI.audit.test.ts";
const source = fs.readFileSync(path, "utf8");
const before = `        analyzeDocument: async <T>() => {\n          attempts.push(config.model || "");\n          if (config.model === "gemini-one") throw new Error("first unavailable");\n          return {\n            provider: "gemini",\n            model: config.model || "",\n            text: '{"status":"ok"}',\n            data: { status: "ok" } as T,\n          };\n        },\n        testConnection: async () => ({ success: true, provider: "gemini", model: config.model || "" }),`;
const after = `        analyzeDocument: async <T>() => {\n          attempts.push(config.model || "");\n          if (config.model === "gemini-one") throw new Error("first unavailable");\n          return {\n            provider: "gemini",\n            model: config.model || "",\n            text: '{"status":"ok"}',\n            data: { status: "ok" } as T,\n          };\n        },\n        transcribeAudio: async () => { throw new Error("unused"); },\n        testConnection: async () => ({ success: true, provider: "gemini", model: config.model || "" }),`;
const matches = source.split(before).length - 1;
if (matches !== 1) throw new Error(`Expected exactly one provider mock match, found ${matches}`);
fs.writeFileSync(path, source.replace(before, after));
console.log("Updated AIProvider test mock with transcribeAudio contract.");
