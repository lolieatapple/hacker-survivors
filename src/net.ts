// Leaderboard client. The Worker in worker/index.ts serves /api/*.
// These functions throw on any failure; callers at the UI edge decide what to show.

export interface Entry { rank: number; name: string; assets: number; cleared: number; won: boolean; me?: boolean }
export interface Board { top: Entry[]; me: Entry | null }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${body}`);
  return JSON.parse(body) as T;
}

/** Tell the server a run started, so it can check that later scores took real play time. */
export const registerRun = (runId: string, playerId: string) =>
  call<{ ok: true }>('/api/run', { method: 'POST', body: JSON.stringify({ runId, playerId }) });

export const submitScore = (s: { runId: string; playerId: string; name: string; assets: number; cleared: number; won: boolean }) =>
  call<{ rank: number }>('/api/score', { method: 'POST', body: JSON.stringify(s) });

export const fetchBoard = (playerId: string) => call<Board>(`/api/top?player=${encodeURIComponent(playerId)}`);

/** Open a pre-filled post on X. Must run inside a tap/click handler or popups get blocked. */
export function shareOnX(text: string) {
  const url = location.origin + '/';
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
}
