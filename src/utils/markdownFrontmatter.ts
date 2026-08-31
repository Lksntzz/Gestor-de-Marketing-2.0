export interface ParsedMarkdownDocument {
  frontmatter: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

type ParsedBlock = {
  value: unknown;
  nextIndex: number;
};

function indentationOf(line: string): number {
  let count = 0;
  for (const char of line) {
    if (char === " ") count += 1;
    else if (char === "\t") count += 2;
    else break;
  }
  return count;
}

function stripInlineComment(value: string): string {
  let single = false;
  let double = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if (char === "'" && !double) {
      if (single && value[index + 1] === "'") {
        index += 1;
        continue;
      }
      single = !single;
      continue;
    }
    if (char === '"' && !single && previous !== "\\") {
      double = !double;
      continue;
    }
    if (single || double) continue;

    if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "#" && bracketDepth === 0 && braceDepth === 0) {
      if (index === 0 || /\s/.test(value[index - 1])) return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function splitCommaSeparated(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let single = false;
  let double = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && previous !== "\\") double = !double;
    else if (!single && !double) {
      if (char === "[") bracketDepth += 1;
      else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
      else if (char === "{") braceDepth += 1;
      else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
      else if (char === "," && bracketDepth === 0 && braceDepth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }
  if (current.trim() || value.endsWith(",")) result.push(current.trim());
  return result;
}

function findMappingColon(value: string): number {
  let single = false;
  let double = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && previous !== "\\") double = !double;
    else if (!single && !double) {
      if (char === "[") bracketDepth += 1;
      else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
      else if (char === "{") braceDepth += 1;
      else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
      else if (char === ":" && bracketDepth === 0 && braceDepth === 0) return index;
    }
  }
  return -1;
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    try {
      return JSON.parse(`"${inner.replace(/"/g, '\\"')}"`);
    } catch {
      return inner
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }
  return value;
}

function parseScalar(rawValue: string): unknown {
  const value = stripInlineComment(rawValue.trim());
  if (!value) return "";
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return unquote(value);
  }
  if (value === "~" || /^(?:null)$/i.test(value)) return null;
  if (/^(?:true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner ? splitCommaSeparated(inner).map(parseScalar) : [];
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const object: Record<string, unknown> = {};
    const inner = value.slice(1, -1).trim();
    for (const part of splitCommaSeparated(inner)) {
      const colon = findMappingColon(part);
      if (colon <= 0) continue;
      const key = unquote(part.slice(0, colon).trim());
      object[key] = parseScalar(part.slice(colon + 1));
    }
    return object;
  }
  return value;
}

function nextMeaningfulLine(lines: string[], fromIndex: number): number {
  for (let index = fromIndex; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed && !trimmed.startsWith("#")) return index;
  }
  return lines.length;
}

function parseBlockScalar(
  lines: string[],
  startIndex: number,
  parentIndent: number,
  folded: boolean,
): ParsedBlock {
  const collected: string[] = [];
  let index = startIndex;
  let contentIndent: number | null = null;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const indent = indentationOf(line);
    if (trimmed && indent <= parentIndent) break;
    if (trimmed && contentIndent === null) contentIndent = indent;

    if (!trimmed) {
      collected.push("");
    } else {
      collected.push(line.slice(Math.min(contentIndent ?? indent, line.length)));
    }
    index += 1;
  }

  if (!folded) return { value: collected.join("\n").replace(/\n+$/, ""), nextIndex: index };

  const paragraphs: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) paragraphs.push(paragraph.join(" "));
    paragraph = [];
  };
  for (const line of collected) {
    if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return { value: paragraphs.join("\n"), nextIndex: index };
}

function parseArray(lines: string[], startIndex: number, indent: number): ParsedBlock {
  const result: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }
    const currentIndent = indentationOf(line);
    if (currentIndent < indent || currentIndent !== indent || !trimmed.startsWith("-")) break;

    const rest = trimmed.slice(1).trim();
    if (!rest) {
      const childIndex = nextMeaningfulLine(lines, index + 1);
      if (childIndex < lines.length && indentationOf(lines[childIndex]) > indent) {
        const child = parseBlock(lines, childIndex, indentationOf(lines[childIndex]));
        result.push(child.value);
        index = child.nextIndex;
      } else {
        result.push(null);
        index += 1;
      }
      continue;
    }

    const colon = findMappingColon(rest);
    if (colon > 0) {
      const object: Record<string, unknown> = {};
      const key = unquote(rest.slice(0, colon).trim());
      const rawValue = rest.slice(colon + 1).trim();
      object[key] = rawValue ? parseScalar(rawValue) : null;
      index += 1;

      while (index < lines.length) {
        const nestedLine = lines[index];
        const nestedTrimmed = nestedLine.trim();
        if (!nestedTrimmed || nestedTrimmed.startsWith("#")) {
          index += 1;
          continue;
        }
        const nestedIndent = indentationOf(nestedLine);
        if (nestedIndent <= indent) break;
        if (nestedTrimmed.startsWith("- ") && nestedIndent === indent) break;
        const nestedColon = findMappingColon(nestedTrimmed);
        if (nestedColon <= 0) break;
        const nestedKey = unquote(nestedTrimmed.slice(0, nestedColon).trim());
        const nestedRaw = nestedTrimmed.slice(nestedColon + 1).trim();
        if (nestedRaw) {
          object[nestedKey] = parseScalar(nestedRaw);
          index += 1;
        } else {
          const childIndex = nextMeaningfulLine(lines, index + 1);
          if (childIndex < lines.length && indentationOf(lines[childIndex]) > nestedIndent) {
            const child = parseBlock(lines, childIndex, indentationOf(lines[childIndex]));
            object[nestedKey] = child.value;
            index = child.nextIndex;
          } else {
            object[nestedKey] = null;
            index += 1;
          }
        }
      }
      result.push(object);
      continue;
    }

    result.push(parseScalar(rest));
    index += 1;
  }

  return { value: result, nextIndex: index };
}

function parseObject(lines: string[], startIndex: number, indent: number): ParsedBlock {
  const result: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }

    const currentIndent = indentationOf(line);
    if (currentIndent < indent || currentIndent !== indent || trimmed.startsWith("- ")) break;
    const colon = findMappingColon(trimmed);
    if (colon <= 0) {
      index += 1;
      continue;
    }

    const key = unquote(trimmed.slice(0, colon).trim());
    const rawValue = trimmed.slice(colon + 1).trim();

    if (rawValue === "|" || rawValue.startsWith("|-") || rawValue.startsWith("|+")) {
      const block = parseBlockScalar(lines, index + 1, indent, false);
      result[key] = block.value;
      index = block.nextIndex;
      continue;
    }
    if (rawValue === ">" || rawValue.startsWith(">-") || rawValue.startsWith(">+")) {
      const block = parseBlockScalar(lines, index + 1, indent, true);
      result[key] = block.value;
      index = block.nextIndex;
      continue;
    }
    if (rawValue) {
      result[key] = parseScalar(rawValue);
      index += 1;
      continue;
    }

    const childIndex = nextMeaningfulLine(lines, index + 1);
    if (childIndex < lines.length && indentationOf(lines[childIndex]) > indent) {
      const child = parseBlock(lines, childIndex, indentationOf(lines[childIndex]));
      result[key] = child.value;
      index = child.nextIndex;
    } else {
      result[key] = null;
      index += 1;
    }
  }

  return { value: result, nextIndex: index };
}

function parseBlock(lines: string[], startIndex: number, indent: number): ParsedBlock {
  const meaningful = nextMeaningfulLine(lines, startIndex);
  if (meaningful >= lines.length) return { value: {}, nextIndex: lines.length };
  return lines[meaningful].trim().startsWith("-")
    ? parseArray(lines, meaningful, indent)
    : parseObject(lines, meaningful, indent);
}

export function parseObsidianFrontmatter(source: string): Record<string, unknown> {
  const normalized = String(source || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return {};
  const lines = normalized.split("\n");
  const parsed = parseObject(lines, 0, 0).value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

export function parseMarkdownDocument(content: string): ParsedMarkdownDocument {
  const source = String(content ?? "").replace(/^\uFEFF/, "");
  const match = source.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { frontmatter: {}, body: source, hasFrontmatter: false };

  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = parseObsidianFrontmatter(match[1]);
  } catch {
    frontmatter = {};
  }
  return {
    frontmatter,
    body: source.slice(match[0].length).trimStart(),
    hasFrontmatter: true,
  };
}

export function normalizeFrontmatterTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]/)
      : [];

  return Array.from(new Set(
    raw
      .map((item) => String(item ?? "").trim().replace(/^#/, ""))
      .filter(Boolean),
  ));
}
