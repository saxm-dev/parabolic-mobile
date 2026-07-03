/**
 * Identity: guest-first, signup claims the guest account (mirrors web src/lib/auth.js).
 *
 * - A fresh install gets a random guest UUID, registered via POST /api/users
 *   (backend grants the standard $10k paper balance). Guests trade ungated.
 * - register() passes claimUserId so balance/history carry over to the account.
 * - Auth session { userId, username, token } lives in secure storage; the token
 *   is attached to order/profile writes for credentialed accounts.
 */
import * as Crypto from 'expo-crypto';

import { API_URL } from '@/lib/api';
import { getItem, removeItem, setItem } from '@/lib/storage';

const AUTH_KEY = 'parabolic_auth';
const GUEST_KEY = 'parabolic_guest_id';
const WELCOME_KEY = 'parabolic_seen_welcome';

export interface AuthSession {
  userId: string;
  username: string;
  token: string;
}

interface IdentityState {
  ready: boolean;
  auth: AuthSession | null;
  guestId: string | null;
  seenWelcome: boolean;
}

const state: IdentityState = { ready: false, auth: null, guestId: null, seenWelcome: false };

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeIdentity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

export function identity(): Readonly<IdentityState> {
  return state;
}

/** The userId to trade/read as: authenticated account if logged in, else the guest. */
export function currentUserId(): string | null {
  return state.auth?.userId ?? state.guestId;
}

export function authToken(): string | null {
  return state.auth?.token ?? null;
}

export function isLoggedIn(): boolean {
  return !!state.auth?.token;
}

/** Load persisted identity; create + register a guest if none exists. Idempotent. */
export async function initIdentity(): Promise<void> {
  if (state.ready) return;
  const [rawAuth, guestId, seen] = await Promise.all([
    getItem(AUTH_KEY),
    getItem(GUEST_KEY),
    getItem(WELCOME_KEY),
  ]);
  try {
    state.auth = rawAuth ? (JSON.parse(rawAuth) as AuthSession) : null;
  } catch {
    state.auth = null;
  }
  state.guestId = guestId;
  state.seenWelcome = seen === '1';
  if (!state.guestId) {
    state.guestId = Crypto.randomUUID();
    await setItem(GUEST_KEY, state.guestId);
    registerGuest(state.guestId); // fire-and-forget; backend creates the $10k account
  }
  state.ready = true;
  emit();
}

async function registerGuest(userId: string): Promise<void> {
  try {
    await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch {
    // Offline first launch — the backend also creates users lazily on first order.
  }
}

export async function markWelcomeSeen(): Promise<void> {
  state.seenWelcome = true;
  await setItem(WELCOME_KEY, '1');
  emit();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export async function register(username: string, password: string): Promise<AuthSession> {
  const data = await post<AuthSession>('/auth/register', {
    username,
    password,
    claimUserId: state.guestId ?? undefined,
  });
  await setAuth(data);
  return data;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const data = await post<AuthSession>('/auth/login', { username, password });
  await setAuth(data);
  return data;
}

async function setAuth(a: AuthSession): Promise<void> {
  state.auth = a;
  await setItem(AUTH_KEY, JSON.stringify(a));
  if (a.userId) {
    // Keep the trading id in sync (login on a fresh device adopts the account id).
    state.guestId = a.userId;
    await setItem(GUEST_KEY, a.userId);
  }
  emit();
}

export async function logout(): Promise<void> {
  state.auth = null;
  await removeItem(AUTH_KEY);
  // Mint a fresh guest identity: the old trading id belongs to a credentialed
  // account, which can't chat/trade without its token. Signed out = clean guest.
  state.guestId = Crypto.randomUUID();
  await setItem(GUEST_KEY, state.guestId);
  registerGuest(state.guestId);
  emit();
}
