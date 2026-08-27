import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const viteImport = 'import { createServer as createViteServer } from "vite";';
const viteCall = "const vite = await createViteServer({";
const pdfImport = 'import * as pdfParseModule from "pdf-parse";';
const pdfParserLine = 'const parseFn: any = (pdfParseModule as any).default || pdfParseModule;';

await build({
  entryPoints: ["secure-server.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: true,
  outfile: "dist/server.cjs",
  external: ["vite"],
  plugins: [
    {
      name: "defer-dev-and-optional-runtime-imports",
      setup(ctx) {
        ctx.onLoad({ filter: /(?:^|[\\/])server\.ts$/ }, async (args) => {
          let source = await readFile(args.path, "utf8");

          if (
            !source.includes(viteImport) ||
            !source.includes(viteCall) ||
            !source.includes(pdfImport) ||
            !source.includes(pdfParserLine)
          ) {
            throw new Error("server.ts mudou e o transform de produção precisa ser revisado.");
          }

          source = source.replace(`${viteImport}\n`, "");
          source = source.replace(
            viteCall,
            'const { createServer: createViteServer } = await import("vite");\n    const vite = await createViteServer({'
          );

          source = source.replace(`${pdfImport}\n`, "");
          source = source.replace(
            pdfParserLine,
            'const pdfParseModule = await import("pdf-parse");\n    const parseFn: any = (pdfParseModule as any).default || pdfParseModule;'
          );

          return { contents: source, loader: "ts" };
        });
      },
    },
  ],
});
