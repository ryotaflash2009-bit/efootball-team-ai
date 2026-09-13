/**
 * アカウントスコープID(localStorageキーの名前空間識別だけに使う、非秘密のハッシュ)。
 *
 * - 入力はSupabase Authの認証済みユーザーID(UUID)だけ。メールアドレス・トークン・Cookie・
 *   Project URL・Publishable keyは一切使わない。
 * - 用途別の固定プレフィックスと組み合わせてSHA-256でハッシュ化する。
 * - 生のユーザーIDはlocalStorageへ一切保存しない(保存するのはこのハッシュだけ)。
 * - このハッシュは認証・認可には使わない(RLSの代替ではない)。通常UI・ログ・報告へも表示しない。
 * - `my-team-cloud-provenance.ts`の目印(誤保存防止ヒント)とは目的が異なるため、
 *   意図的に別のプレフィックスを使う(こちらはキー名の名前空間識別、あちらは保存前の
 *   由来確認ヒント)。どちらも同じ「認証ユーザーID + 固定プレフィックス + SHA-256」の
 *   パターンを踏襲する。
 */

const SCOPE_ID_PREFIX = "efootball-team-ai:local-storage-scope:v1:";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 認証済みユーザーIDからアカウントスコープIDを計算する。
 * 空文字列・空白のみ・null/undefinedはすべて「取得できない」として扱い、nullを返す
 * (呼び出し側はnullの場合、認証済み領域へは一切アクセスしない)。
 */
export async function computeAccountScopeId(userId: string | null | undefined): Promise<string | null> {
  if (typeof userId !== "string") return null;
  const trimmed = userId.trim();
  if (trimmed.length === 0) return null;
  return sha256Hex(`${SCOPE_ID_PREFIX}${trimmed}`);
}
