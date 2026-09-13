/**
 * My Teamクラウド保存(手動PoC)専用: ローカルMy Teamの「由来(どのアカウントに
 * 最後に紐づいたか)」を判定するための最小限の目印。
 *
 * 背景: 現在のlocalStorage(My Team・My Builds・お気に入り・保存スカッド・
 * スカッドテンプレート)はアカウント別の名前空間を持たず、同一ブラウザーで
 * 複数アカウントを切り替えると、ローカルデータがそのまま共有されて見える
 * (実Supabase手動検証で確認済みの既知の制約)。本格的なアカウント別
 * localStorage名前空間への移行は本PoCの範囲外のため、ここでは
 * 「別アカウント由来の可能性があるデータを、無確認でクラウド保存させない」
 * ことだけを目的とした最小限の安全策を実装する。
 *
 * 重要な設計制約:
 *  - このハッシュは**誤保存防止用の非秘密ヒント**に過ぎない。認証・認可には
 *    一切使わず、Row Level Security(RLS)の代替にもしない
 *    (所有者判定は常にRLSだけで行う。これはUXの安全策であり、セキュリティ境界ではない)。
 *  - 入力はSupabase Authの認証済みユーザーID(UUID)であり、用途別の固定
 *    プレフィックスと組み合わせてSHA-256でハッシュ化する。
 *    (`efootball-team-ai:local-account-hint:v1:<authenticated-user-id>`)
 *  - 生のユーザーID・メールアドレス・メールアドレスのハッシュのいずれも保存しない
 *    (localStorageに残るのはSHA-256ハッシュ値だけ)。
 *  - 書き込みは「クラウドへ保存」が成功し保存後の再取得検証にも成功した場合、
 *    または「ローカルへ反映」が成功した場合、その直後だけに限定する。
 *    ログイン・ログアウト・ページ表示・セッション復元では一切書き込まない。
 *  - 保存形式にはバージョン番号を含め、旧バージョン(未知の形式・過去のメール由来の
 *    実装等)は安全にUNKNOWN扱いとし、それを根拠に自動保存はしない。
 */

export const LOCAL_ACCOUNT_HINT_KEY = "efootball-team-ai:local-account-hint:v1";
export const LOCAL_ACCOUNT_HINT_VERSION = "my-team-cloud-account-hint/2026-09-13.v2";

export type ProvenanceStatus = "MATCH" | "MISMATCH" | "UNKNOWN";

interface StoredAccountHint {
  version: string;
  accountHash: string;
  /** 非機密の参考情報(ISO日時)。認証・認可判定には使わない。 */
  updatedAt: string;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 認証済みユーザーIDから目印(ハッシュ)を計算する。ユーザーID不明なら計算できない(null)。
 * メールアドレスは入力に一切使わない(メール変更で判定が変化しないようにするため)。
 */
export async function computeAccountHint(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  return sha256Hex(`efootball-team-ai:local-account-hint:v1:${userId}`);
}

function isStoredAccountHint(v: unknown): v is StoredAccountHint {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.version === "string" && typeof r.accountHash === "string" && typeof r.updatedAt === "string";
}

/**
 * 記録済みの目印を読み取る。壊れたJSON・未知のフィールド構成・**旧バージョン
 * (メール由来ヒント等)はすべて「記録なし」として扱う(安全側=UNKNOWN扱いになる)。
 */
function readStoredAccountHint(): StoredAccountHint | null {
  const ls = getStorage();
  if (!ls) return null;
  let raw: string | null;
  try {
    raw = ls.getItem(LOCAL_ACCOUNT_HINT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isStoredAccountHint(parsed)) return null;
  if (parsed.version !== LOCAL_ACCOUNT_HINT_VERSION) return null;
  return parsed;
}

/**
 * 現在の認証済みユーザーIDと、このブラウザーに記録済みの目印を比較する。
 *  - UNKNOWN: ユーザーIDが取得できない、目印が未記録、または未知/旧バージョンの目印しかない
 *    (このブラウザーでの初回利用・過去のメール由来ヒント等を含む)。
 *  - MATCH: 記録済みの目印(現バージョン)と現在のアカウントが一致する。
 *  - MISMATCH: 記録済みの目印(現バージョン)が現在のアカウントと異なる(別アカウント由来の可能性)。
 */
export async function checkAccountProvenance(userId: string | null): Promise<ProvenanceStatus> {
  const currentHash = await computeAccountHint(userId);
  if (!currentHash) return "UNKNOWN";
  const stored = readStoredAccountHint();
  if (!stored) return "UNKNOWN";
  return stored.accountHash === currentHash ? "MATCH" : "MISMATCH";
}

/** クラウド保存(再取得検証成功後)/ローカル反映が成功した直後にだけ呼び出す。 */
export async function recordAccountHint(userId: string | null): Promise<void> {
  const hash = await computeAccountHint(userId);
  if (!hash) return;
  const ls = getStorage();
  if (!ls) return;
  const payload: StoredAccountHint = {
    version: LOCAL_ACCOUNT_HINT_VERSION,
    accountHash: hash,
    updatedAt: new Date().toISOString(),
  };
  try {
    ls.setItem(LOCAL_ACCOUNT_HINT_KEY, JSON.stringify(payload));
  } catch {
    /* 保存できなくても致命的ではない(次回もUNKNOWN扱いになるだけ)。 */
  }
}

/**
 * クラウド保存を進めてよいか(=由来の明示確認が必要か)を判定する、唯一の判定ロジック。
 *
 * 呼び出し側(`MyTeamCloudView.tsx`)は、確認ダイアログの実行ボタンの`disabled`属性と、
 * 保存処理本体(イベントハンドラー)の冒頭ガードの**両方**からこの関数だけを呼ぶ。
 * 判定条件を2箇所に別々に書かないことで、「画面は無効化されているのに処理だけ実行されてしまう」
 * 「画面は有効なのに処理だけ拒否される」といった食い違いを構造的に起こり得なくする。
 */
export function isProvenanceConfirmationRequired(status: ProvenanceStatus | null, acknowledged: boolean): boolean {
  return status !== "MATCH" && !acknowledged;
}

/** テスト専用: 記録済みの目印を消去する。 */
export function __clearAccountHintForTests(): void {
  const ls = getStorage();
  if (!ls) return;
  try {
    ls.removeItem(LOCAL_ACCOUNT_HINT_KEY);
  } catch {
    /* noop */
  }
}
