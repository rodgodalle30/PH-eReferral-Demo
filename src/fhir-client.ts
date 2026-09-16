import { config } from "./config.js";

export class FhirHttpError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`FHIR server returned HTTP ${status}`);
  }
}

export async function fhirRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/fhir+json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/fhir+json");


  const response = await fetch(`${config.FHIR_BASE_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
  if (!response.ok) throw new FhirHttpError(response.status, body);
  return body;
}
