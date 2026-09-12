/**
 * 「ローカル開発ホスト(このPC自身)かどうか」を判定する純関数。
 *
 * 用途:
 * - サインアップ成功画面で「確認リンクはこのPCで開いてください」という開発環境限定の
 *   案内を出すかどうかの判定(本番ドメインでは絶対に表示しない)。
 * - ブラックボックステスト用の認証テストダブル注入を許可するかどうかの判定
 *   (実行環境が本番ドメインであれば絶対に注入を受け付けない)。
 *
 * `process.env.NODE_ENV`はビルド時に固定されるため、
 * 「`next build`で作ったPCで`next start`している」ような状態を区別できない
 * (どちらもNODE_ENV==="production")。実際に確認リンクが機能するかどうかは
 * 「今アプリを開いているホスト名」で決まるため、`window.location.hostname`を
 * 基準に判定する。
 */

const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDevHostname(hostname: string): boolean {
  return LOCAL_DEV_HOSTNAMES.has(hostname.toLowerCase());
}
