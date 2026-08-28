import "node:http";

declare module "node:http" {
  interface IncomingHttpHeaders {
    "x-gemini-api-key"?: string;
    "x-ai-api-key"?: string;
    "x-ai-provider"?: string;
    "x-ai-model"?: string;
    "x-app-session-token"?: string;
  }
}
