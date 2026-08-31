import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sidebar = readFileSync(path.join(root, "src/components/Sidebar.tsx"), "utf8");

test("sidebar uses the Nisti brand mark in both identity positions", () => {
  const uses = sidebar.match(/<NistiBrandMark/g) ?? [];
  expect(uses.length).toBe(2);
  expect(sidebar).toContain("#FF95BA");
  expect(sidebar).toContain("#30CED0");
  expect(sidebar).toContain("#FFF164");
  expect(sidebar).toContain("#C8C9CB");
});

test("legacy N and NP placeholders are not rendered", () => {
  expect(sidebar).not.toMatch(/>\s*NP\s*</);
  expect(sidebar).not.toContain("nisti-pink-grad");
});

test("bottom brand mark preserves the connection status indicator", () => {
  expect(sidebar).toContain("bg-emerald-500");
  expect(sidebar).toContain('title="Nisti Print - Marketing Hub"');
});
