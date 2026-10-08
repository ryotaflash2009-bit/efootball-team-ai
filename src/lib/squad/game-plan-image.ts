import type { GamePlan } from "./game-plan";

/**
 * ゲームプランの共有画像（2026-10-09・F-143 の残り）。画像の中身は「表示用の文」だけで作る（純関数・テスト可能）。
 * - ID（スカッド・カード・利用者）・URL・保存データの形は載せない。選手名・枠の名前・メモは利用者が見ている表示のまま。
 * - 未設定の項目は載せない（空の欄を「未設定」で埋めない）。何も設定していなければ画像を作らない（null）。
 * - メモは 1 行あたりの長さで折り返し、行数の上限で切る（画像からはみ出さない）。
 */
export interface GamePlanImageLabels {
  title: string;
  instructions: string;
  attacking: string;
  defensiveLine: string;
  pressing: string;
  note: string;
  substitutions: string;
  alternative: string;
  opponents: string;
  footer: string;
  /** 「{minute}分 {out} → {in}（{reason}）」の形。minute が無いときは minuteUnknown を使う。 */
  subTemplate: string;
  /** 「{n}分」の形。 */
  minuteTemplate: string;
  minuteUnknown: string;
}

export interface GamePlanImageResolvers {
  attacking: (v: NonNullable<GamePlan["instructions"]["attacking"]>) => string;
  defensiveLine: (v: NonNullable<GamePlan["instructions"]["defensiveLine"]>) => string;
  pressing: (v: NonNullable<GamePlan["instructions"]["pressing"]>) => string;
  reason: (v: GamePlan["substitutions"][number]["reason"]) => string;
  trigger: (v: NonNullable<GamePlan["alternative"]["trigger"]>) => string;
  slotLabel: (slotId: string) => string;
  playerName: (worldCardId: string) => string;
  formationName: (formationId: string) => string;
  adjustment: (id: string) => string;
}

export interface GamePlanImageSection {
  heading: string;
  lines: string[];
}

export interface GamePlanImageModel {
  title: string;
  subtitle: string;
  sections: GamePlanImageSection[];
  footer: string;
}

export const NOTE_IMAGE_MAX_CHARS = 120;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function buildGamePlanImageModel(
  plan: GamePlan,
  ctx: { squadName: string; formationName: string; labels: GamePlanImageLabels; r: GamePlanImageResolvers },
): GamePlanImageModel | null {
  const { labels: L, r } = ctx;
  const sections: GamePlanImageSection[] = [];

  const ins: string[] = [];
  if (plan.instructions.attacking) ins.push(`${L.attacking}: ${r.attacking(plan.instructions.attacking)}`);
  if (plan.instructions.defensiveLine) ins.push(`${L.defensiveLine}: ${r.defensiveLine(plan.instructions.defensiveLine)}`);
  if (plan.instructions.pressing) ins.push(`${L.pressing}: ${r.pressing(plan.instructions.pressing)}`);
  if (plan.instructions.note.trim()) ins.push(`${L.note}: ${clip(plan.instructions.note.trim(), NOTE_IMAGE_MAX_CHARS)}`);
  if (ins.length) sections.push({ heading: L.instructions, lines: ins });

  const subs = [...plan.substitutions]
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))
    .map((s) =>
      L.subTemplate
        .replace("{minute}", s.minute == null ? L.minuteUnknown : L.minuteTemplate.replace("{n}", String(s.minute)))
        .replace("{out}", r.slotLabel(s.outSlotId))
        .replace("{in}", r.playerName(s.inWorldCardId))
        .replace("{reason}", r.reason(s.reason)),
    );
  if (subs.length) sections.push({ heading: L.substitutions, lines: subs });

  const alt: string[] = [];
  if (plan.alternative.formationId) alt.push(`${r.formationName(plan.alternative.formationId)}${plan.alternative.trigger ? `（${r.trigger(plan.alternative.trigger)}）` : ""}`);
  else if (plan.alternative.trigger) alt.push(r.trigger(plan.alternative.trigger));
  if (plan.alternative.note.trim()) alt.push(clip(plan.alternative.note.trim(), NOTE_IMAGE_MAX_CHARS));
  if (alt.length) sections.push({ heading: L.alternative, lines: alt });

  const opp = plan.opponents
    .filter((o) => o.label.trim() || o.adjustments.length || o.note.trim())
    .map((o) => {
      const adj = o.adjustments.map((a) => r.adjustment(a)).join("・");
      return [o.label.trim(), adj, clip(o.note.trim(), 60)].filter(Boolean).join(" — ");
    });
  if (opp.length) sections.push({ heading: L.opponents, lines: opp });

  if (sections.length === 0) return null;
  return { title: L.title, subtitle: [ctx.squadName.trim(), ctx.formationName].filter(Boolean).join(" ・ "), sections, footer: L.footer };
}

/** 文字の幅で折り返す（measure は canvas の measureText を渡す。テストでは文字数で代用）。 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of [...text]) {
    if (line && measure(line + ch) > maxWidth) {
      out.push(line);
      line = ch.trim() ? ch : "";
    } else line += ch;
  }
  if (line) out.push(line);
  return out;
}

export const GAME_PLAN_IMAGE_SIZE = { width: 1080, height: 1440 } as const;

/** 画像を描く（3:4・1080×1440）。行が多いときは最後に「…」を出して止める。 */
export function drawGamePlanCard(canvas: HTMLCanvasElement, model: GamePlanImageModel): void {
  const { width: W, height: H } = GAME_PLAN_IMAGE_SIZE;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const font = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif';
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(0, 0, W, 12);
  const pad = 72;
  let y = 120;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f8fafc";
  ctx.font = `bold 56px ${font}`;
  ctx.fillText(model.title, pad, y);
  y += 56;
  if (model.subtitle) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `32px ${font}`;
    for (const l of wrapText(model.subtitle, W - pad * 2, (s) => ctx.measureText(s).width).slice(0, 2)) {
      ctx.fillText(l, pad, y);
      y += 44;
    }
  }
  y += 24;
  const bottom = H - 120;
  let truncated = false;
  outer: for (const sec of model.sections) {
    if (y + 100 > bottom) {
      truncated = true;
      break;
    }
    ctx.fillStyle = "#22c55e";
    ctx.font = `bold 36px ${font}`;
    ctx.fillText(sec.heading, pad, y);
    y += 52;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `30px ${font}`;
    for (const line of sec.lines) {
      for (const w of wrapText(line, W - pad * 2 - 24, (s) => ctx.measureText(s).width)) {
        if (y > bottom) {
          truncated = true;
          break outer;
        }
        ctx.fillText(w, pad + 24, y);
        y += 42;
      }
    }
    y += 28;
  }
  if (truncated) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `30px ${font}`;
    ctx.fillText("…", pad + 24, Math.min(y, bottom + 30));
  }
  ctx.fillStyle = "#64748b";
  ctx.font = `24px ${font}`;
  ctx.fillText(model.footer, pad, H - 56);
}

/** ファイル名（ID・名前を入れない・端末の日付）。 */
export function gamePlanImageFileName(formationId: string, date: Date): string {
  const f = /^[a-z0-9-]{1,16}$/.test(formationId) ? formationId : "plan";
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `efootball-team-ai-game-plan-${f}-${ymd}.png`;
}
