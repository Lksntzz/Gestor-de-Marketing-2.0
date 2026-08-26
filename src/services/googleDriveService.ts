// Google Drive API & Google Picker Integration for Nisti PKM & Marketing Hub

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

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

class GoogleDriveService {
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isGsiLoaded: boolean = false;
  private isGapiLoaded: boolean = false;

  constructor() {
    const saved = sessionStorage.getItem("gdrive_access_token");
    const expiry = sessionStorage.getItem("gdrive_token_expiry");
    if (saved && expiry && Number(expiry) > Date.now()) {
      this.accessToken = saved;
      this.tokenExpiry = Number(expiry);
    }
  }

  public async initClient(): Promise<boolean> {
    if (this.isGsiLoaded && this.isGapiLoaded) return true;

    if (!(window as any).google?.accounts?.oauth2) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Falha ao carregar script do Google Identity Services."));
        document.head.appendChild(script);
      });
    }
    this.isGsiLoaded = true;

    if (!(window as any).gapi) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Falha ao carregar script do Google API Client."));
        document.head.appendChild(script);
      });
    }
    this.isGapiLoaded = true;

    await new Promise<void>((resolve) => {
      (window as any).gapi.load("picker", () => resolve());
    });

    return true;
  }

  public async getAccessToken(clientId?: string): Promise<string> {
    if (this.accessToken && this.tokenExpiry > Date.now() + 60000) {
      return this.accessToken;
    }

    await this.initClient();

    const targetClientId =
      clientId ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      "293792153293-client.apps.googleusercontent.com";

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
            this.tokenExpiry =
              Date.now() + (Number(response.expires_in) || 3600) * 1000;
            sessionStorage.setItem("gdrive_access_token", this.accessToken!);
            sessionStorage.setItem(
              "gdrive_token_expiry",
              this.tokenExpiry.toString()
            );
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
      } catch (e) {
        // ignore
      }
    }
    this.accessToken = null;
    this.tokenExpiry = 0;
    sessionStorage.removeItem("gdrive_access_token");
    sessionStorage.removeItem("gdrive_token_expiry");
  }

  public async listFiles(searchQuery?: string): Promise<GoogleDriveFile[]> {
    const token = await this.getAccessToken();
    let q = "trashed = false";
    if (searchQuery) {
      const sanitized = searchQuery.replace(/'/g, "\\'");
      q += " and (name contains '" + sanitized + "' or fullText contains '" + sanitized + "')";
    }

    const fields =
      "files(id, name, mimeType, iconLink, thumbnailLink, webViewLink, size, modifiedTime)";
    const url =
      "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent(q) +
      "&pageSize=20&orderBy=modifiedTime desc&fields=" +
      encodeURIComponent(fields);

    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.disconnect();
      }
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
      modifiedTime: f.modifiedTime
        ? new Date(f.modifiedTime).toLocaleDateString("pt-BR")
        : undefined,
    }));
  }

  public async fetchFileContent(
    file: GoogleDriveFile
  ): Promise<{ text: string; base64?: string; isPdf?: boolean }> {
    const token = await this.getAccessToken();

    if (file.mimeType === "application/vnd.google-apps.document") {
      const exportUrl =
        "https://www.googleapis.com/drive/v3/files/" +
        file.id +
        "/export?mimeType=text/plain";
      const res = await fetch(exportUrl, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Erro ao exportar documento do Google Docs.");
      const text = await res.text();
      return { text };
    }

    if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
      const exportUrl =
        "https://www.googleapis.com/drive/v3/files/" +
        file.id +
        "/export?mimeType=text/csv";
      const res = await fetch(exportUrl, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Erro ao exportar planilha do Google Sheets.");
      const text = await res.text();
      return { text };
    }

    const downloadUrl =
      "https://www.googleapis.com/drive/v3/files/" + file.id + "?alt=media";
    const res = await fetch(downloadUrl, {
      headers: { Authorization: "Bearer " + token },
    });

    if (!res.ok) throw new Error("Erro ao baixar arquivo do Google Drive.");

    if (
      file.mimeType.includes("pdf") ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return {
        text: "[Arquivo importado do Google Drive: " + file.name + "]",
        base64,
        isPdf: true,
      };
    }

    if (
      file.mimeType.startsWith("text/") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".txt")
    ) {
      const text = await res.text();
      return { text };
    }

    if (file.mimeType.startsWith("image/")) {
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return {
        text: "[Imagem importada do Google Drive: " + file.name + "]",
        base64,
      };
    }

    const raw = await res.text();
    return { text: raw.slice(0, 10000) };
  }
}

export const googleDriveService = new GoogleDriveService();
