import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagerById, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { MANAGER_ID_RE } from "@/lib/managers/schemas";
import { ProficiencyBar } from "@/components/managers/ProficiencyBar";
import { topTactic, tacticTier, TACTIC_TEXT, managerInitials } from "@/components/managers/tactics";
import { PageContainer } from "@/components/ui/PageContainer";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { DISPLAY_TIME_ZONE } from "@/lib/i18n/format";

export const runtime = "nodejs";
export const revalidate = 300;

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // サーバー(Vercel、UTC)の時間帯に依存せず、日本時間で時間帯名を付けて表示する(src/lib/i18n/format.tsと同じ方針)。
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP", { hour12: false, timeZone: DISPLAY_TIME_ZONE, timeZoneName: "short" });
}

export default async function ManagerDetailPage({ params }: { params: Promise<{ managerId: string }> }) {
  const { managerId } = await params;
  const decoded = decodeURIComponent(managerId);
  if (!MANAGER_ID_RE.test(decoded)) notFound();

  let manager: Awaited<ReturnType<typeof getManagerById>> = null;
  try {
    manager = await getManagerById(decoded);
  } catch (err) {
    if (err instanceof ManagerDataUnavailableError) {
      return (
        <PageContainer>
          <EmptyState
            variant="error"
            icon="database"
            title="監督データが利用できません"
            action={
              <Link href="/managers" className="text-sm text-accent">
                マネージャー一覧へ戻る
              </Link>
            }
          />
        </PageContainer>
      );
    }
    throw err;
  }
  if (!manager) notFound();

  const top = topTactic(manager.proficiencies);

  const NOT_IN_SOURCE = [
    { label: "年齢", value: manager.age },
    { label: "国籍", value: manager.nationality },
    { label: "チーム", value: manager.teamName },
    { label: "監督レーティング", value: manager.managerRating },
    { label: "Coaching Affinity", value: manager.coachingAffinity },
    { label: "フォーメーション", value: manager.formation },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <Link href="/managers" className="inline-flex w-fit items-center gap-1 text-sm text-text-dim hover:text-accent">
          <Icon name="chevron-left" size={16} />
          マネージャー一覧へ戻る
        </Link>

        {/* ヒーロー */}
        <Surface tone="raised" padding="lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-3 text-xl font-black text-text-dim">
              {managerInitials(manager.nameEn)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold">{manager.nameEn}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="neutral">リリース {manager.releasedAt ?? "不明"}</Badge>
                <Badge tone="outline">ID {manager.internalManagerId}</Badge>
                <Badge tone="outline">ソース {manager.sourceManagerId}</Badge>
                {manager.hasLinkUpPlay ? <Badge tone="info">Link-Up Play</Badge> : null}
              </div>
            </div>
            {top ? (
              <div className="shrink-0 rounded-md border border-border bg-surface px-4 py-2 text-center">
                <p className="text-2xs text-text-muted">得意戦術</p>
                <p className="text-sm font-semibold">{top.en}</p>
                <p className={`text-2xl font-black tabular-nums ${TACTIC_TEXT[tacticTier(top.value)]}`}>{top.value}</p>
              </div>
            ) : null}
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 戦術適性 */}
          <Surface>
            <SectionHeader title="戦術適性" as="h2" hint="数値・バー・順位。色だけに依存しません" />
            <ProficiencyBar proficiencies={manager.proficiencies} showRank />
          </Surface>

          {/* 監督ブースター */}
          <Surface>
            <SectionHeader
              title="監督ブースター"
              as="h2"
              action={
                manager.boosterConfirmation === "confirmed" ? (
                  <Badge tone="success" size="xs">複数ソースで確認済み</Badge>
                ) : (
                  <Badge tone="warning" size="xs">効果未確認</Badge>
                )
              }
            />
            {manager.boosters.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {manager.boosters.map((b, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{b.statNameEn}</span>
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-bold text-success tabular-nums">
                      {b.rawValue}
                    </span>
                    <span className="ml-auto text-2xs text-text-dim">
                      {b.applicationCondition ?? "無条件"}
                    </span>
                    <Badge tone={b.confirmationStatus === "confirmed" && b.statKey ? "success" : "warning"} size="xs">
                      {b.confirmationStatus === "confirmed" && b.statKey ? "confirmed" : `${b.confirmationStatus}${b.statKey ? "" : "・キー未変換"}`}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-dim">この監督に能力値ブースターはありません。</p>
            )}
            <p className="mt-2 text-2xs text-text-muted">
              確認済みブースターのみ育成・比較・スカッドの能力値へ適用します。適用順序（育成前 / 後）は未確認です。
            </p>
          </Surface>
        </div>

        {/* Link-Up Play */}
        <Surface>
          <SectionHeader title="Link-Up Play" as="h2" hint="発動条件は検証中・能力値へは適用しません" />
          {manager.linkUpPlays.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {manager.linkUpPlays.map((lu, i) => (
                <li key={i} className="rounded-md border border-border bg-surface-2/40 p-3 text-sm">
                  <p className="font-semibold">{lu.name}</p>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-2xs text-text-muted">Center Piece 条件</dt>
                      <dd className="mt-0.5">
                        {lu.centerPiece
                          ? `${lu.centerPiece.playingStyle ?? "?"} / ${lu.centerPiece.positions.join(", ") || "?"}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-text-muted">Key Man 条件</dt>
                      <dd className="mt-0.5">
                        {lu.keyMan
                          ? `${lu.keyMan.playingStyle ?? "?"} / ${lu.keyMan.positions.join(", ") || "?"}`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-dim">この監督に Link-Up Play はありません。</p>
          )}
        </Surface>

        {/* ソース非収録 */}
        <Surface tone="outline">
          <SectionHeader title="ソース非収録（追加調査中）" as="h2" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
            {NOT_IN_SOURCE.map((r) => (
              <div key={r.label}>
                <dt className="text-2xs text-text-muted">{r.label}</dt>
                <dd className="mt-0.5 font-medium">{r.value ?? "追加調査中"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-2xs text-text-muted">
            データ提供: {manager.source} / 取得日時: {fmt(manager.fetchedAt)}
            {manager.sourceUrl ? (
              <>
                {" "}
                ・
                <a
                  href={manager.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-accent underline underline-offset-2"
                >
                  出典を開く
                </a>
              </>
            ) : null}
          </p>
        </Surface>
      </div>
    </PageContainer>
  );
}
