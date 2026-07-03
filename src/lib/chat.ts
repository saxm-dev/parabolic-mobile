/** Per-game chat client (REST poll v1; WS push lands with the live-polish milestone). */
import { API_URL } from '@/lib/api';
import { authToken, currentUserId } from '@/lib/auth';

export interface ChatMessage {
  id: number;
  gameId: string;
  ts: number;
  type: 'user' | 'bet';
  userId?: string;
  username: string;
  text: string;
  /** Sender's position snapshot in this game, if any. */
  pos?: { side: 'home' | 'away'; notional: number } | null;
}

export async function fetchChat(gameId: string, limit = 100): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/chat/${gameId}?limit=${limit}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { messages?: ChatMessage[] };
  return data.messages ?? [];
}

export async function sendChat(gameId: string, text: string): Promise<ChatMessage> {
  const res = await fetch(`${API_URL}/chat/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUserId(), token: authToken() ?? undefined, text }),
  });
  const data = (await res.json().catch(() => ({}))) as ChatMessage & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Message failed to send');
  return data;
}
