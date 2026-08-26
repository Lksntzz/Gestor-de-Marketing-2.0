// Google Drive read-only integration for Nisti PKM & Marketing Hub

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconUrl?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  size?: string;
  modifiedTime?: string;
}

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

class GoogleDriveService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private isGsiLoaded = false;

  public async initClient(): Promise<boolean> {
    if (this.isGsiLoaded) return true;

    if (!(window as any).google?.accounts?.oauth2) {
      await new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
        if (existingScript) {
          existingScript.addEventListener("load", () => resolve(), { once: true });
          existingScript.addEventListener("error", () => reject(new Error("Falha ao carregar Google Identity Services.")), { once: true });
          return;
        }

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Falha ao carregar Google Identity Services."));
        document.head.appendChild(script);
      });
    }

    if (!(window as any).google?.accounts?.oauth2) {
      throw new Error("Google Identity Services não ficou disponível após o carregamento.");
    }

    this.isGsiLoaded = true;
    return true;
  }

  public async getAccessToken(clientId?: string): Promise<string> {
    if (this.accessToken && this.tokenExpiry > Date.now() + 60_000) {
      return this.accessToken;
    }

    await this.initClient();

    const targetClientId = clientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (!targetClientId || typeof targetClientId !== "string") {
      throw new Error("Google Drive não configurado: defina VITE_GOOGLE_CLIENT_ID no ambiente local.");
    }

    return new Promise((resolve, reject) => {
      try {
        const google = (window as any).google;
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: targetClientId,
          scope: SCOPES.join(" "),
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }

            this.accessToken = response.access_token;
            this.tokenExpiry = Date.now() + (Number(response.expires_in) || 3600) * 1000;
            resolve(this.accessToken!);
          },
        });

        this.tokenClient.requestAccessToken({ prompt: "" });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken && this.tokenExpiry > Date.now();
  }

  public disconnect(): void {
    if (this.accessToken && (window as any).google?.accounts?.oauth2) {
      try {
        (window as any).google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch {
        // Revocation is best-effort; the local token is always discarded below.
      }
    }
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.tokenClient = null;
  }

  public async listFiles(searchQuery?: string): Promise<GoogleDriveFile[]> {
    const token = await this.getAccessToken();
    let q = "trashed = false";
    if (searchQuery) {
      const sanitized = searchQuery.replace(/'/g, "\\'");
      q += " and (name contains '" + sanitized + "' or fullText contains '" + sanitized + "')";
    }

    const fields = "files(id, name, mimeType, iconLink, thumbnailLink, webViewLink, size, modifiedTime)";
    const url =
      "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent(q) +
      "&pageSize=20&orderBy=modifiedTime desc&fields=" +
      encodeURIComponent(fields);

    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
    });

    if (!res.ok) {
      if (res.status === 401) this.disconnect();
      throw new Error("Erro ao listar arquivos do Google Drive (" + res.status + ")");
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      iconUrl: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      webViewLink: f.webViewLink,
      size: f.size ? Math.round(Number(f.size) / 1024) + " KB" : undefined,
      modifiedTime: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString("pt-BR") : undefined,
    }));
  }

  public async fetchFileContent(
    file: GoogleDriveFile
  ): Promise<{ text: string; base64?: string; isPdf?: boolean }> {
    const token = await this.getAccessToken();

    if (file.mimeType === "application/vnd.google-apps.document") {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/plain`;
      const res = await fetch(exportUrl, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Erro ao exportar documento do Google Docs.");
      return { text: await res.text() };
    }

    if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/csv`;
      const res = await fetch(exportUrl, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Erro ao exportar planilha do Google Sheets.");
      return { text: await res.text() };
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
    const res = await fetch(downloadUrl, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) throw new Error("Erro ao baixar arquivo do Google Drive.");

    if (file.mimeType.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
      const blob = await res.blob();
      const base64 = await this.blobToDataUrl(blob);
      return {
        text: "[Arquivo importado do Google Drive: " + file.name + "]",
        base64,
        isPdf: true,
      };
    }

    if (file.mimeType.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      return { text: await res.text() };
    }

    if (file.mimeType.startsWith("image/")) {
      const blob = await res.blob();
      return {
        text: "[Imagem importada do Google Drive: " + file.name + "]",
        base64: await this.blobToDataUrl(blob),
      };
    }

    const raw = await res.text();
    return { text: raw.slice(0, 10_000) };
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const googleDriveService = new GoogleDriveService();
