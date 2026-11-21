/** Client minimal de l'API. Les appels passent par la même origine (/v1/*, relayé par Next.js
 *  vers FastAPI). Aucune clé secrète côté client ; authentification par cookie httpOnly (Phase 2). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type Health = {
  status: "ok" | "degraded";
  version: string;
  database: { connected: boolean; pgvector: boolean; schema_version: number | null };
};

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch(`${API_URL}/v1/health`, { signal, credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Health;
}
