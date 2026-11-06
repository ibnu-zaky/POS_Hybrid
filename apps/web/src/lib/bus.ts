// bus.ts — BroadcastChannel sinkronisasi antar tab
// Untuk produksi: ganti API + WebSocket/SSE supaya HP pelanggan benar-benar terhubung ke kasir.
const CHANNEL_NAME = "wk";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

export function broadcast(type: string, payload?: unknown): void {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage({ type, payload });
    } catch {
      // ignore
    }
  }
}

export function onBroadcast(handler: (msg: { type: string; payload?: unknown }) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent) => handler(e.data);
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
