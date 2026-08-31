import { describe, expect, test } from "bun:test";
import {
  detectKnowledgeFileType,
  detectKnowledgeLinkType,
  isSupportedKnowledgeLink,
} from "../src/utils/knowledgeSourceInput";

describe("knowledge source input", () => {
  test("detects supported files without asking the user for a technical subtype", () => {
    expect(detectKnowledgeFileType({ name: "catalogo.pdf", mimeType: "application/pdf" })).toBe("pdf");
    expect(detectKnowledgeFileType({ name: "produto.webp", mimeType: "image/webp" })).toBe("image");
    expect(detectKnowledgeFileType({ name: "produto.JPG" })).toBe("image");
    expect(detectKnowledgeFileType({ name: "reuniao.m4a", mimeType: "audio/mp4" })).toBe("audio");
    expect(detectKnowledgeFileType({ name: "briefing.MP3" })).toBe("audio");
    expect(detectKnowledgeFileType({ name: "animacao.gif", mimeType: "image/gif" })).toBeNull();
    expect(detectKnowledgeFileType({ name: "planilha.xlsx" })).toBeNull();
  });

  test("detects YouTube links and treats other http links as sites", () => {
    expect(detectKnowledgeLinkType("https://www.youtube.com/watch?v=abc123")).toBe("youtube");
    expect(detectKnowledgeLinkType("https://youtu.be/abc123")).toBe("youtube");
    expect(detectKnowledgeLinkType("https://example.com/artigo")).toBe("site");
  });

  test("accepts only http/https links as supported primary link sources", () => {
    expect(isSupportedKnowledgeLink("https://example.com")).toBe(true);
    expect(isSupportedKnowledgeLink("http://localhost:3000/teste")).toBe(true);
    expect(isSupportedKnowledgeLink("file:///C:/segredo.txt")).toBe(false);
    expect(isSupportedKnowledgeLink("javascript:alert(1)")).toBe(false);
    expect(isSupportedKnowledgeLink("nao-e-url")).toBe(false);
  });
});
