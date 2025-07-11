import type { Presence } from "./protocol";

/** Peers that haven't sent a heartbeat for this long are considered gone. */
export const PRESENCE_TTL_MS = 15_000;
export const HEARTBEAT_MS = 5_000;

export class PresenceTracker {
  private peers = new Map<string, Presence>();

  /** Records a heartbeat; returns true if the visible list changed. */
  update(presence: Presence): boolean {
    const existing = this.peers.get(presence.client);
    this.peers.set(presence.client, presence);
    return !existing || existing.name !== presence.name || existing.color !== presence.color;
  }

  /** Live peers, sorted by name, excluding `self`. */
  list(now: number, self?: string): Presence[] {
    for (const [client, p] of this.peers) if (now - p.at > PRESENCE_TTL_MS) this.peers.delete(client);
    return [...this.peers.values()].filter((p) => p.client !== self).sort((a, b) => a.name.localeCompare(b.name));
  }
}

const ADJECTIVES = ["Swift", "Calm", "Bright", "Quiet", "Brave", "Clever", "Gentle", "Lucky"];
const ANIMALS = ["Otter", "Falcon", "Panda", "Fox", "Heron", "Lynx", "Koala", "Robin"];
const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

/** A friendly, stable name and color derived from the client id. */
export function identityFor(clientId: string): { name: string; color: string } {
  let hash = 0;
  for (const ch of clientId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    name: `${ADJECTIVES[hash % ADJECTIVES.length]} ${ANIMALS[(hash >>> 3) % ANIMALS.length]}`,
    color: COLORS[(hash >>> 6) % COLORS.length]!,
  };
}
