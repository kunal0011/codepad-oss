import { randomBytes } from "crypto";

export function generateId(prefix?: string): string {
  const id = randomBytes(12).toString("base64url");
  return prefix ? `${prefix}_${id}` : id;
}

export function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

export function sanitizeOutput(output: string): string {
  return output
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "");
}

export function truncateOutput(output: string, maxBytes: number): { text: string; truncated: boolean } {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(output);
  if (encoded.length <= maxBytes) {
    return { text: output, truncated: false };
  }
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const truncated = decoder.decode(encoded.slice(0, maxBytes));
  return { text: truncated + "\n[output truncated]", truncated: true };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
