import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const viteImport = 'import { createServer as createViteServer } from "vite";';
const viteCall = "const vite = await createViteServer({";

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
      name: "defer-vite-in-server",
      setup(ctx) {
        ctx.onLoad({ filter: /(?:^|[\\/])server\.ts$/ }, async (args) => {
          let source = await readFile(args.path, "utf8");

          if (!source.includes(viteImport) || !source.includes(viteCall)) {
            throw new Error("server.ts mudou e o transform de produção do Vite precisa ser revisado.");
          }

          source = source.replace(`${viteImport}\n`, "");
          source = source.replace(
            viteCall,
            'const { createServer: createViteServer } = await import("vite");\n    const vite = await createViteServer({'
          );

          return { contents: source, loader: "ts" };
        });
      },
    },
  ],
});
