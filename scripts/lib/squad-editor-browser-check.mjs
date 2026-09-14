/**
 * manager-picker ブラックボックスレールの1チェック専用：
 * 「スカッド編集画面：監督未設定時の案内 or 監督一覧導線」の実ブラウザ検証。
 *
 * 背景: この保存スカッド編集画面（/squads/[squadId]）は localStorage 専用データソースで、
 * ready / notfound / nostorage への状態遷移は useEffect 内（クライアント side, マウント後）
 * でのみ発生する。素の curl（SSR HTML のみ）では読み込み中スケルトンしか観測できず、
 * この1チェックだけは curl では原理的に検証意図（監督未設定時の導線・notfound 遷移）を
 * 確認できない。そのため、この1チェックのみヘッドレス Chrome による実描画検証へ置換する。
 *
 * - 隔離された一時プロファイル（--user-data-dir）を毎回新規作成し、終了後に削除する。
 *   実ユーザーの Chrome プロファイル／localStorage には一切触れない。
 * - スカッド保存スキーマ（StoredSquad・SQUAD_SCHEMA_VERSION）は
 *   src/lib/squad/types.ts の現行定義をそのまま踏襲した最小限の fixture のみを使用し、
 *   SquadEditor 本体・監督計算・Link-Up Play 判定のコードは一切変更しない。
 * - 検証後、テスト用タブ・ブラウザプロセス・一時プロファイルはすべて破棄する。
 *
 * Stage 4補足: このレールは未認証(installSupabaseAuthTestDouble、__efbAuthなし)のまま実行するため、
 * アプリは常にguestスコープに解決される。よってfixtureはguestスコープの実際のキー
 * (src/lib/local-storage-scope/keys.ts の buildScopedStorageKey({kind:"guest"}, "squads")と
 * 完全一致させる。推測で値を変えない)へ書き込む。レガシー共通キー(efb:squads:v1)は、
 * Stage 4でスコープ対応した squad-storage.ts からはもう読み書きされない。
 */

import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./headless-chrome.mjs";

const GUEST_SQUADS_STORAGE_KEY = "efootball-team-ai:local:guest:squads:v1";
const LOCALE_STORAGE_KEY = "efootball-team-ai:locale:v1";

// 既存スキーマ（src/lib/squad/types.ts の StoredSquad）に合わせた最小限の fixture。
// slots/substitutes は空配列で可（squad-storage.ts の normalizeSquad が
// フォーメーション既定値で安全に補完する）。
function buildFixtureSquad(squadId) {
  const now = new Date().toISOString();
  return {
    squadId,
    squadName: "Headless BB Fixture",
    formationId: "4-3-3",
    managerId: null,
    slots: [],
    substitutes: [],
    captainSlotId: null,
    setPieces: { corners: null, freeKicks: null, penalties: null },
    linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    rulesVersion: "progression/2026-08-28.v2",
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

async function evalString(client, expression) {
  const res = await client.send("Runtime.evaluate", { expression, returnByValue: true });
  if (res?.exceptionDetails) throw new Error(`page 内評価で例外: ${res.exceptionDetails.text}`);
  return res?.result?.value ?? "";
}

async function navigateAndSettle(client, url) {
  await client.send("Page.navigate", { url });
  // 決定的な画面状態: document.readyState === "complete"（固定 sleep ではなくポーリング）。
  await waitForCondition(async () => (await evalString(client, "document.readyState")) === "complete", {
    timeoutMs: 6000,
    intervalMs: 100,
  });
}

/**
 * 検証意図（従来のcurlチェックが確認できなかった範囲を実描画で確認）:
 *  - 保存スカッド編集画面がブラウザー上で初期化される
 *  - localStorage 読み取り後に読み込み状態（スケルトン）から遷移する
 *  - 監督未設定時の案内 + 監督一覧を開く導線（CurrentManagerCard / SquadManagerPanel）が存在する
 *  - 存在しないスカッドIDでは notfound 表示へ遷移する
 *  - 日本語／英語の選択状態に応じて実際の描画テキストが切り替わる
 *  - クライアント初期化中のスケルトン文言を最終状態として誤判定しない
 */
export async function verifySquadEditorManagerGuidance(baseUrl) {
  let browser = null;
  let client = null;
  let tab = null;
  const notes = [];
  try {
    browser = await launchIsolatedBrowser();
    tab = await openTab(browser.port, "about:blank");
    client = connectCDP(tab.webSocketDebuggerUrl);
    await client.ready;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await installSupabaseAuthTestDouble(client); // ヘッダーの認証状態表示が実Supabaseへ接続しないようにする(このレールは認証と無関係)
    // デスクトップ幅を明示（Tailwind lg: ブレークポイント未満だと監督パネルが
    // モバイルタブ切替の裏に隠れ、そもそも innerText へ現れないため）。
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // --- シナリオ1: 存在しないスカッドID（有効な形式・localStorage 空）→ notfound へ遷移 ---
    const notfoundId = "sq_bbheadlessnf01";
    await navigateAndSettle(client, `${baseUrl}/squads/${notfoundId}`);
    const notfoundText = await waitForCondition(
      async () => {
        const t = await evalString(client, "document.body.innerText");
        return t.includes("スカッドが見つかりません") ? t : null;
      },
      { timeoutMs: 8000, intervalMs: 200 },
    );
    // スケルトンの読み込み文言のままではない（＝クライアント初期化中を最終状態と誤判定していない）ことも確認。
    const notfoundOk = !!notfoundText && !notfoundText.includes("スカッドを読み込んでいます");
    notes.push(`notfound(ja)=${notfoundOk ? "OK" : "FAIL"}`);

    // --- シナリオ2: 有効な保存スカッド（監督未設定）を隔離 localStorage へ設定 → ready 状態（ja） ---
    const readyId = "sq_bbheadlessrd01";
    await navigateAndSettle(client, `${baseUrl}/squads/${readyId}`);
    await client.send("Runtime.evaluate", {
      expression: `localStorage.setItem(${JSON.stringify(GUEST_SQUADS_STORAGE_KEY)}, ${JSON.stringify(
        JSON.stringify([buildFixtureSquad(readyId)]),
      )})`,
    });
    await navigateAndSettle(client, `${baseUrl}/squads/${readyId}`);
    const readyJaText = await waitForCondition(
      async () => {
        const t = await evalString(client, "document.body.innerText");
        return t.includes("監督一覧から選択") && t.includes("監督なし") ? t : null;
      },
      { timeoutMs: 8000, intervalMs: 200 },
    );
    const readyJaOk = !!readyJaText && !readyJaText.includes("スカッドを読み込んでいます");
    notes.push(`ready(ja)=${readyJaOk ? "OK" : "FAIL"}`);

    // --- シナリオ3: 同じ保存スカッドのままロケールを en へ切替 → 実描画が英語へ追従 ---
    await client.send("Runtime.evaluate", {
      expression: `localStorage.setItem(${JSON.stringify(LOCALE_STORAGE_KEY)}, "en")`,
    });
    await navigateAndSettle(client, `${baseUrl}/squads/${readyId}`);
    const readyEnText = await waitForCondition(
      async () => {
        const t = await evalString(client, "document.body.innerText");
        return t.includes("Choose from manager list") && t.includes("No manager selected") ? t : null;
      },
      { timeoutMs: 8000, intervalMs: 200 },
    );
    const readyEnOk = !!readyEnText && !readyEnText.includes("Loading squad");
    notes.push(`ready(en)=${readyEnOk ? "OK" : "FAIL"}`);

    return { ok: notfoundOk && readyJaOk && readyEnOk, detail: notes.join(" / ") };
  } catch (e) {
    return { ok: false, detail: `例外: ${e?.message ?? String(e)}` };
  } finally {
    try {
      if (tab && browser) await closeTab(browser.port, tab.id);
    } catch {
      /* noop */
    }
    try {
      client?.close();
    } catch {
      /* noop */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* noop */
    }
  }
}
