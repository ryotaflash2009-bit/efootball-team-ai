/**
 * お気に入り / My Team のローカル保存が変わったことを、同一タブ内の全コンポーネントへ通知する
 * 極小の pub-sub。`useSyncExternalStore` から購読する。
 * cross-tab（`storage` イベント）は各ストレージモジュール側で拾い、ここへ通知する。
 */

type Channel = "favorites" | "my-team";

const listeners: Record<Channel, Set<() => void>> = {
  favorites: new Set(),
  "my-team": new Set(),
};

export function subscribeUserCards(channel: Channel, cb: () => void): () => void {
  listeners[channel].add(cb);
  return () => {
    listeners[channel].delete(cb);
  };
}

export function notifyUserCards(channel: Channel): void {
  for (const cb of [...listeners[channel]]) cb();
}
