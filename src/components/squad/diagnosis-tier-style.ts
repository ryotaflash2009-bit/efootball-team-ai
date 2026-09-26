import type { SquadDiagnosisTier } from "@/lib/squad/squad-diagnosis";

/** 診断ランクの表示色（スカッド診断パネルと共有診断ページで共通）。 */
export function tierBadgeTone(tier: SquadDiagnosisTier | null): "success" | "info" | "neutral" | "warning" | "danger" {
  switch (tier) {
    case "S":
      return "success";
    case "A":
      return "info";
    case "B":
      return "neutral";
    case "C":
      return "warning";
    case "D":
      return "danger";
    default:
      return "neutral";
  }
}

export function tierBarClass(tier: SquadDiagnosisTier | null): string {
  switch (tier) {
    case "S":
      return "bg-success";
    case "A":
      return "bg-info";
    case "B":
      return "bg-text-dim";
    case "C":
      return "bg-warning";
    case "D":
      return "bg-danger";
    default:
      return "bg-text-muted";
  }
}
