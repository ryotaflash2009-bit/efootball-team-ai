"use client";

import type { LocalPost } from "./post-model";
import type { AuditEntry, PostBackend } from "./post-store";

/**
 * F-084: ブラウザーの IndexedDB に投稿・画像・監査ログを保存する（この端末だけ。サーバーへ送らない）。
 * localStorage は画像には小さすぎるため IndexedDB を使う。所有者（領域）ごとに読み書きを分ける。
 */
const DB_NAME = "efootball-team-ai-local-posts";
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("indexeddb_unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("posts")) db.createObjectStore("posts", { keyPath: "id" }).createIndex("owner", "owner");
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
      if (!db.objectStoreNames.contains("audit")) db.createObjectStore("audit");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb_open_failed"));
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        let value: T | undefined;
        if (req) req.onsuccess = () => (value = req.result);
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("indexeddb_tx_failed"));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("indexeddb_tx_aborted"));
        };
      }),
  );
}

export class IdbPostBackend implements PostBackend {
  async getPosts(owner: string): Promise<LocalPost[]> {
    const list = (await run<LocalPost[]>("posts", "readonly", (s) => s.index("owner").getAll(owner))) ?? [];
    return list;
  }
  async putPost(post: LocalPost): Promise<void> {
    await run("posts", "readwrite", (s) => s.put(post));
  }
  async putImage(key: string, owner: string, blob: Blob): Promise<void> {
    await run("images", "readwrite", (s) => s.put({ owner, blob }, key));
  }
  async getImage(key: string, owner: string): Promise<Blob | null> {
    const v = await run<{ owner: string; blob: Blob } | undefined>("images", "readonly", (s) => s.get(key));
    return v && v.owner === owner ? v.blob : null;
  }
  async deleteImage(key: string, owner: string): Promise<void> {
    const v = await run<{ owner: string; blob: Blob } | undefined>("images", "readonly", (s) => s.get(key));
    if (v && v.owner === owner) await run("images", "readwrite", (s) => s.delete(key));
  }
  async getAudit(owner: string): Promise<AuditEntry[]> {
    return ((await run<AuditEntry[]>("audit", "readonly", (s) => s.get(owner))) ?? []).slice();
  }
  async putAudit(owner: string, entries: AuditEntry[]): Promise<void> {
    await run("audit", "readwrite", (s) => s.put(entries, owner));
  }
}
