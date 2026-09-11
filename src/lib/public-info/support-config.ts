/**
 * 問い合わせ・不具合報告・権利者連絡の窓口設定(公開前設定モデル)。
 *
 * - 運営者(上杉さん)が実際に作成・送受信確認済みの公開専用メールアドレスを設定している。
 *   このメールアドレスは、一般問い合わせ・不具合報告・権利者からの連絡・プライバシー問い合わせの
 *   4用途で共用する(初期段階では用途別に別アドレスを用意しない、という運営者の明示的な指示による)。
 * - 運営者がこのファイルの値だけを書き換えれば、問い合わせページの表示が自動的に切り替わる
 *   (呼び出し側のUI・ルーティングは変更不要)。
 * - `enabled` は形式検証に成功した場合だけ true になる({@link buildConfiguredSupportConfig} 参照)。
 *   将来ここへ誤って不正な値を設定しても、検証に失敗すれば自動的に未設定(安全側)へフォールバックする。
 * - 未設定の間は、通常利用者向けUIへ「{SUPPORT_EMAIL}」等の未置換文字列や
 *   「example@example.com」のようなダミー値を一切表示せず、「公開前準備中」という
 *   安全な文言だけを表示する(呼び出し側の責務。このファイルは設定値の保持と検証のみ行う)。
 */

export interface PublicSupportConfig {
  /** 一般的な問い合わせ用メールアドレス。未設定なら null。 */
  supportEmail: string | null;
  /** 不具合報告(Issue Tracker等)のURL。未設定なら null。 */
  issueTrackerUrl: string | null;
  /** 権利者(選手・カード・データ・画像等の権利保持者)専用の連絡先メールアドレス。未設定なら null。 */
  rightsContactEmail: string | null;
  /** プライバシーに関する問い合わせ専用のメールアドレス。未設定なら null。 */
  privacyContactEmail: string | null;
  /** 上記のいずれかが利用可能な状態として運営者が明示的に有効化したかどうか。 */
  enabled: boolean;
}

const SAFE_EMAIL_RE = /^[^\s@<>"]+@[^\s@<>".]+\.[^\s@<>"]+$/;

/**
 * 表示してよい形式のメールアドレスかどうかを検証する(危険なスキーム混入・制御文字混入を防ぐ)。
 * 空文字・null・不正な形式は false を返し、呼び出し側は非表示として扱う。
 *
 * 注意: 「よくあるスペルミスの自動修正」は行わない。例えば "suport" のように一般的な英単語
 * "support" とは異なる綴りであっても、形式(ローカル部@ドメイン.TLD)を満たしていれば有効な
 * メールアドレスとして扱う。実際に運営者が作成・送受信確認済みの綴りをこの関数が勝手に
 * 「誤り」と判定してはならない。
 */
export function isDisplayableSupportEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length > 254) return false;
  if (/[\s<>" -]/.test(value)) return false;
  return SAFE_EMAIL_RE.test(value);
}

/**
 * 表示・リンク先として安全なURLかどうかを検証する(http/httpsのみ許可。
 * javascript: 等の危険なスキームや相対パスの誤設定を拒否する)。
 */
export function isDisplayableSupportUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * 運営者が作成・送受信確認済みの公開専用メールアドレス(唯一の正本表記)。
 * 「suport」は一般的な英単語「support」とはpの数が異なるが、これはスペルミスではなく
 * 実際に作成されたメールアドレスそのものであり、自動修正しない
 * ({@link isDisplayableSupportEmail} のコメントも参照)。
 * 大文字・小文字はメールシステム上同一に扱われ得るが、表示・設定値は運営者提示の表記を
 * そのまま用いる。
 */
const CONFIGURED_SUPPORT_EMAIL = "efootballteamAIsuportteam@outlook.jp";

/**
 * 設定値を構築する。メールアドレスが有効な形式である場合だけ `enabled: true` にする
 * (形式検証に失敗した場合は、誤って問い合わせ窓口が有効化されないよう、安全側の
 * 未設定状態にフォールバックする)。
 */
function buildConfiguredSupportConfig(): PublicSupportConfig {
  if (!isDisplayableSupportEmail(CONFIGURED_SUPPORT_EMAIL)) {
    return { supportEmail: null, issueTrackerUrl: null, rightsContactEmail: null, privacyContactEmail: null, enabled: false };
  }
  // 初期段階では、一般問い合わせ・不具合報告・権利者からの連絡・プライバシー問い合わせの
  // 4用途を、運営者の指示どおり同一の公開専用メールアドレスで共用する。
  return {
    supportEmail: CONFIGURED_SUPPORT_EMAIL,
    issueTrackerUrl: null,
    rightsContactEmail: CONFIGURED_SUPPORT_EMAIL,
    privacyContactEmail: CONFIGURED_SUPPORT_EMAIL,
    enabled: true,
  };
}

/** 現時点の公開前設定。 */
export const PUBLIC_SUPPORT_CONFIG: PublicSupportConfig = buildConfiguredSupportConfig();

export interface ResolvedSupportChannels {
  supportEmail: string | null;
  issueTrackerUrl: string | null;
  rightsContactEmail: string | null;
  privacyContactEmail: string | null;
  /** いずれか1つでも安全に表示できる連絡先があるか。 */
  hasAnyChannel: boolean;
}

/**
 * 設定値を安全性検証込みで解決する。`enabled: false` の場合、または個々の値が
 * 表示可能な形式でない場合は、その項目を null として扱う(呼び出し側は必ずこの関数を
 * 経由し、`PUBLIC_SUPPORT_CONFIG` の生の値を直接UIへ出さない)。
 */
export function resolveSupportChannels(config: PublicSupportConfig = PUBLIC_SUPPORT_CONFIG): ResolvedSupportChannels {
  if (!config.enabled) {
    return { supportEmail: null, issueTrackerUrl: null, rightsContactEmail: null, privacyContactEmail: null, hasAnyChannel: false };
  }
  const supportEmail = isDisplayableSupportEmail(config.supportEmail) ? config.supportEmail : null;
  const issueTrackerUrl = isDisplayableSupportUrl(config.issueTrackerUrl) ? config.issueTrackerUrl : null;
  const rightsContactEmail = isDisplayableSupportEmail(config.rightsContactEmail) ? config.rightsContactEmail : null;
  const privacyContactEmail = isDisplayableSupportEmail(config.privacyContactEmail) ? config.privacyContactEmail : null;
  return {
    supportEmail,
    issueTrackerUrl,
    rightsContactEmail,
    privacyContactEmail,
    hasAnyChannel: supportEmail != null || issueTrackerUrl != null || rightsContactEmail != null || privacyContactEmail != null,
  };
}
