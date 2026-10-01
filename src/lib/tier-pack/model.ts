/**
 * Tier・Pack（F-090/F-092）の型と合成モック。本人の判断（2026-10-02 B）:
 * 権利が確認できるまで外部のデータを取得・保存・再配布しない。型・UI モック・分離の設計・情報源と更新時刻の表示はよい。
 *
 * - データはすべて合成（架空の名前・値）。実在の選手・カード ID・外部の URL を持たない（テストで確認）。
 * - 表示の可否は情報源の種類と権利の状態で決める（pending の外部データは表示しない）。
 */

export const TIER_PACK_MODEL_VERSION = "tier-pack-model/2026-10-02.v1";

export type SourceKind = "synthetic" | "own_rules" | "external";
/** synthetic: 合成の例 / own_data: 自前の確定データから計算 / pending: 権利の確認待ち / cleared: 権利の確認済み */
export type RightsStatus = "synthetic" | "own_data" | "pending" | "cleared";

export interface DataSource {
  kind: SourceKind;
  /** 画面に出す情報源の名前。 */
  label: string;
  /** 外部の情報源だけ。権利の確認前は null のまま（取得しない）。 */
  url: string | null;
  updatedAt: string;
  rightsStatus: RightsStatus;
}

export type TierRank = "S" | "A" | "B" | "C";

export interface TierEntryMock {
  /** 合成の識別子（実在のカード ID を使わない）。 */
  id: string;
  name: string;
  position: string;
  rank: TierRank;
  /** 根拠（自前の規則のときは規則の名前と値）。 */
  basis: string;
}

export interface TierListMock {
  id: string;
  title: string;
  source: DataSource;
  entries: TierEntryMock[];
}

export interface PackMock {
  id: string;
  title: string;
  source: DataSource;
  /** 期間（ISO 日付）。 */
  period: { from: string; to: string };
  featured: { name: string; position: string }[];
}

export type DisplayContext = "internal_preview" | "public";
export type DisplayDecision = { display: true; label: string } | { display: false; reason: "rights_pending" | "synthetic_not_public" | "external_without_clearance" | "invalid_source" };

/** 表示してよいか。外部は cleared のときだけ、合成は内部の試作画面だけ。 */
export function decideDisplay(source: DataSource, context: DisplayContext): DisplayDecision {
  if (!source.label || !Number.isFinite(Date.parse(source.updatedAt))) return { display: false, reason: "invalid_source" };
  switch (source.kind) {
    case "synthetic":
      return source.rightsStatus === "synthetic" && context === "internal_preview" ? { display: true, label: "合成データ（例）" } : { display: false, reason: "synthetic_not_public" };
    case "own_rules":
      return source.rightsStatus === "own_data" ? { display: true, label: "自前の規則による評価" } : { display: false, reason: "invalid_source" };
    case "external":
      if (source.rightsStatus === "pending") return { display: false, reason: "rights_pending" };
      return source.rightsStatus === "cleared" ? { display: true, label: `出典: ${source.label}` } : { display: false, reason: "external_without_clearance" };
  }
}

const SYNTHETIC_SOURCE: DataSource = { kind: "synthetic", label: "合成データ", url: null, updatedAt: "2026-10-02T00:00:00Z", rightsStatus: "synthetic" };

/** 合成のモック（架空の名前だけ）。 */
export const SYNTHETIC_TIER_LIST: TierListMock = {
  id: "mock-tier-1",
  title: "ティアリストの表示例",
  source: SYNTHETIC_SOURCE,
  entries: [
    { id: "mock-1", name: "Sample Forward A", position: "CF", rank: "S", basis: "例: 規則の値 92" },
    { id: "mock-2", name: "Sample Winger B", position: "RWF", rank: "A", basis: "例: 規則の値 85" },
    { id: "mock-3", name: "Sample Midfielder C", position: "CMF", rank: "A", basis: "例: 規則の値 83" },
    { id: "mock-4", name: "Sample Defender D", position: "CB", rank: "B", basis: "例: 規則の値 76" },
    { id: "mock-5", name: "Sample Keeper E", position: "GK", rank: "C", basis: "例: 規則の値 68" },
  ],
};

export const SYNTHETIC_PACK: PackMock = {
  id: "mock-pack-1",
  title: "パックの表示例",
  source: SYNTHETIC_SOURCE,
  period: { from: "2026-10-01", to: "2026-10-08" },
  featured: [
    { name: "Sample Forward A", position: "CF" },
    { name: "Sample Defender D", position: "CB" },
  ],
};

/** 外部の情報源（権利の確認待ち）の例。取得はしない（url は null）。 */
export const PENDING_EXTERNAL_SOURCE: DataSource = { kind: "external", label: "外部の情報源（未定）", url: null, updatedAt: "2026-10-02T00:00:00Z", rightsStatus: "pending" };
