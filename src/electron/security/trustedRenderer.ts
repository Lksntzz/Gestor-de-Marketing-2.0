import type { IpcMainInvokeEvent } from "electron";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function isTrustedRendererUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) return false;

    if (parsed.protocol === "http:") {
      return LOOPBACK_HOSTS.has(parsed.hostname) && Boolean(parsed.port);
    }

    return false;
  } catch {
    return false;
  }
}

export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const senderFrame = event.senderFrame;
  if (
    !senderFrame
    || senderFrame !== event.sender.mainFrame
    || !isTrustedRendererUrl(senderFrame.url)
  ) {
    throw new Error("IPC bloqueado: origem do renderer não autorizada.");
  }
}

export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === "https:" || parsed.protocol === "obsidian:";
  } catch {
    return false;
  }
}
