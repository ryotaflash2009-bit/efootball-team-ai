import type { CompatibilityInfo, CompatibilityStatus, SlotRole } from "./types";

/**
 * 配置ポジション適性の分類。
 *
 * World 側は副ポジション適性を取得できていない。したがって:
 *  - 断言できるのは「登録と一致」か「GK⇔フィールドの不一致」だけ。
 *  - それ以外は「適性未確認」に留め、架空の能力値低下・OVR低下を計算しない。
 */

const POSITION_ROLE: Record<string, SlotRole> = {
  GK: "GK",
  CB: "DF", LB: "DF", RB: "DF",
  DMF: "MF", CMF: "MF", LMF: "MF", RMF: "MF", AMF: "MF",
  LWF: "FW", RWF: "FW", SS: "FW", CF: "FW",
};

export function roleOfPosition(position: string | null | undefined): SlotRole | null {
  if (!position) return null;
  return POSITION_ROLE[position] ?? null;
}

export function evaluateCompatibility(
  registeredPosition: string | null,
  assignedPosition: string,
): CompatibilityInfo {
  const base = { registeredPosition, assignedPosition };

  if (!registeredPosition) {
    return {
      ...base,
      status: "unresolved",
      label: "適性未確認",
      note: "登録ポジションのデータがありません。",
    };
  }

  if (registeredPosition === assignedPosition) {
    return { ...base, status: "exact", label: "登録ポジションと一致", note: null };
  }

  const regRole = roleOfPosition(registeredPosition);
  const asgRole = roleOfPosition(assignedPosition);

  if ((regRole === "GK") !== (asgRole === "GK")) {
    return {
      ...base,
      status: "gkMismatch",
      label: "不適性の可能性",
      note: "GK とフィールドプレーヤーの組み合わせです。",
    };
  }

  if (regRole != null && regRole === asgRole) {
    return {
      ...base,
      status: "related",
      label: "適性未確認（近いポジション）",
      note: "同じ系統のポジションですが、副ポジション適性は未確認です。",
    };
  }

  return {
    ...base,
    status: "unresolved",
    label: "適性未確認",
    note: "副ポジション適性のデータがありません。能力値は下げていません。",
  };
}

export function emptyCompatibility(assignedPosition: string): CompatibilityInfo {
  return {
    status: "empty",
    registeredPosition: null,
    assignedPosition,
    label: "未配置",
    note: null,
  };
}

/** 未確認扱い（related / unresolved）か */
export function isUnresolvedCompatibility(status: CompatibilityStatus): boolean {
  return status === "related" || status === "unresolved";
}
