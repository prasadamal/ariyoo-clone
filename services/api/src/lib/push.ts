import { prisma } from '../prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export type PushKind = 'question' | 'reply' | 'claimed' | 'thanked';

const COPY: Record<PushKind, { title: string; body: string }> = {
  question: { title: 'New question for you', body: 'Someone asked about a topic you know. Open Ariyoo to answer.' },
  reply: { title: 'New message', body: 'You have a new message in Ariyoo.' },
  claimed: { title: 'An expert picked up your question', body: 'Open Ariyoo to continue the conversation.' },
  thanked: { title: 'Your answer helped', body: 'Someone marked your answer as helpful. Thank you!' },
};

/** What goes over the wire: never the message text, only a pointer to the conversation. */
export function buildPush(tokens: string[], kind: PushKind, sessionId: number) {
  return tokens.filter(t => EXPO_TOKEN.test(t)).map(to => ({
    to, sound: 'default', channelId: 'messages', ...COPY[kind], data: { sessionId, kind },
  }));
}

/** Best effort: a failed push never fails the request that triggered it. */
export async function notifyUsers(userIds: (number | null | undefined)[], kind: PushKind, sessionId: number): Promise<void> {
  if (process.env.PUSH_DISABLED === '1') return;
  const ids = [...new Set(userIds.filter((id): id is number => typeof id === 'number'))];
  if (!ids.length) return;
  try {
    const rows = await prisma.pushToken.findMany({ where: { userId: { in: ids } }, select: { token: true } });
    const messages = buildPush(rows.map(r => r.token), kind, sessionId);
    if (!messages.length) return;
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages), signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
    // Tokens of uninstalled apps are dropped so they are not retried forever.
    const dead = (body?.data ?? []).map((r, i) => (r?.details?.error === 'DeviceNotRegistered' ? messages[i].to : null)).filter((t): t is string => !!t);
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  } catch {
    // offline, provider down, etc.
  }
}
