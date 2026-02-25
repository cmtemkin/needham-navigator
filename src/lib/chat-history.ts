import type { ChatMessage } from "@/components/ChatBubble";

export interface SavedConversation {
  id: string;
  townId: string;
  title: string; // first user message
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "nn-chat-history";
const MAX_CONVERSATIONS = 20;

export function getConversations(townId: string): SavedConversation[] {
  if (globalThis.window === undefined) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: SavedConversation[] = raw ? JSON.parse(raw) : [];
    return all.filter((c) => c.townId === townId).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function saveConversation(conversation: SavedConversation): void {
  if (globalThis.window === undefined) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let all: SavedConversation[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) {
      all[idx] = conversation;
    } else {
      all.unshift(conversation);
    }
    // Keep max per town
    const towns = new Set(all.map((c) => c.townId));
    for (const t of towns) {
      const townConvos = all.filter((c) => c.townId === t);
      if (townConvos.length > MAX_CONVERSATIONS) {
        const toRemove = new Set(
          townConvos.slice(MAX_CONVERSATIONS).map((c) => c.id)
        );
        all = all.filter((c) => !toRemove.has(c.id));
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore quota errors */ }
}

export function deleteConversation(id: string): void {
  if (globalThis.window === undefined) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: SavedConversation[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((c) => c.id !== id)));
  } catch { /* ignore */ }
}
