import "node:http";

declare module "node:http" {
  interface IncomingHttpHeaders {
    "x-gemini-api-key"?: string;
    "x-app-session-token"?: string;
  }
}
