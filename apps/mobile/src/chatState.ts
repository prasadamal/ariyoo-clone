export type ChatMessage = {
  id?: number;
  messageText?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  senderId: number;
};

export type ChatState = {
  load: 'loading' | 'ready' | 'error';
  operation: 'idle' | 'sending' | 'picking' | 'uploading';
  messages: ChatMessage[];
  error: string | null;
  request: number;
};

export const initialChatState: ChatState = {
  load: 'loading', operation: 'idle', messages: [], error: null, request: 0,
};

type ChatEvent =
  | { type: 'load'; request: number }
  | { type: 'loaded'; request: number; messages: ChatMessage[] }
  | { type: 'loadFailed'; request: number; error: string }
  | { type: 'received'; message: ChatMessage }
  | { type: 'operation'; operation: ChatState['operation'] }
  | { type: 'failed'; error: string };

/** HTTP history and socket echoes share server IDs; neither may erase the other. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<number, ChatMessage>();
  const withoutId: ChatMessage[] = [];
  for (const message of [...current, ...incoming]) {
    if (message.id == null) withoutId.push(message);
    else byId.set(message.id, { ...byId.get(message.id), ...message });
  }
  return [...byId.values(), ...withoutId].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || (a.id ?? 0) - (b.id ?? 0));
}

/** Pure transitions; requests, socket subscriptions and image picking stay in the screen. */
export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case 'load':
      return { ...state, load: 'loading', request: event.request, error: null };
    case 'loaded':
      if (event.request !== state.request) return state;
      return { ...state, load: 'ready', messages: mergeMessages(state.messages, event.messages) };
    case 'loadFailed':
      if (event.request !== state.request) return state;
      return { ...state, load: 'error', error: event.error };
    case 'received':
      return { ...state, messages: mergeMessages(state.messages, [event.message]) };
    case 'operation':
      return { ...state, operation: event.operation, error: event.operation === 'idle' ? state.error : null };
    case 'failed':
      return { ...state, operation: 'idle', error: event.error };
  }
}
