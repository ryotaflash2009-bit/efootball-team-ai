"use client";

import "@/lib/i18n/dictionaries/ja-ns/localPosts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { getSafeLocalStorage } from "@/lib/local-storage-scope/storage-access";
import { listSquadEntries } from "@/lib/squad/squad-storage";
import { readDiagnosisHistory } from "@/lib/squad/diagnosis-history";
import { encodeSharePayload } from "@/lib/squad/squad-diagnosis-share-url";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { checkSelectedFile, processPostImage, type ProcessFailure, type ProcessedImage } from "@/lib/posts/image-process";
import { IdbPostBackend } from "@/lib/posts/idb-backend";
import { PostStore } from "@/lib/posts/post-store";
import { CATEGORIES, EMPTY_LINKS, POST_LIMITS, PURPOSES, VISIBILITIES, type LocalPost, type PostCategory, type PostLinks, type PostPurpose, type Visibility } from "@/lib/posts/post-model";
import { LocalSafetySample } from "./LocalSafetySample";

type LpKey = keyof Dictionary["localPosts"];
type Rotation = 0 | 90 | 180 | 270;
type CropMode = "none" | "square";

const FAILURE_KEY: Record<ProcessFailure, LpKey> = {
  empty: "errEmpty",
  too_large_file: "errTooLarge",
  svg_not_allowed: "errNotImage",
  gif_not_allowed: "errGif",
  executable_or_document: "errNotImage",
  unknown_format: "errNotImage",
  mime_mismatch: "errMismatch",
  corrupt_header: "errCorrupt",
  too_many_pixels: "errTooManyPixels",
  too_small: "errTooSmall",
  heic_unsupported: "errHeic",
  decode_failed: "errCorrupt",
  encode_failed: "errEncode",
  still_too_large: "errEncode",
  aborted: "errAborted",
};

/**
 * F-084 写真付き投稿（ローカル/モック・内部ページ）。この端末の IndexedDB にだけ保存し、どこへも送信・公開しない。
 */
export function LocalPostsView() {
  const t = useT();
  const lp = (k: LpKey) => t("localPosts", k);
  const scopeState = useSyncedStorageScope();
  const owner = scopeState.status === "resolved" ? (scopeState.scope.kind === "guest" ? "guest" : `account:${scopeState.scope.scopeId}`) : null;
  const store = useMemo(() => (owner ? new PostStore(new IdbPostBackend(), owner) : null), [owner]);
  const [posts, setPosts] = useState<LocalPost[]>([]);
  const [loadError, setLoadError] = useState(false);
  const reload = useCallback(async () => {
    if (!store) return;
    try {
      setPosts(await store.list());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [store]);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lp("pageTitle")} icon="community" description={lp("pageDescription")} />
      <p role="note" className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="local-posts-banner">
        {lp("localOnlyBanner")}
      </p>
      {!store ? (
        <p className="text-sm text-text-muted" role="status">
          {lp("scopePending")}
        </p>
      ) : (
        <>
          <Composer store={store} lp={lp} onSaved={reload} drafts={posts.filter((p) => p.status === "draft")} />
          <MyPosts store={store} posts={posts} lp={lp} onChanged={reload} loadError={loadError} />
          <LocalSafetySample scopeKey={owner!} />
        </>
      )}
    </div>
  );
}

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Composer({ store, lp, onSaved, drafts }: { store: PostStore; lp: (k: LpKey) => string; onSaved: () => Promise<void>; drafts: LocalPost[] }) {
  const { myTeam } = useMyTeam();
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<CropMode>("none");
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "processing" | "saving">("idle");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [body, setBody] = useState("");
  const [alt, setAlt] = useState("");
  const [category, setCategory] = useState<PostCategory>("squad");
  const [purpose, setPurpose] = useState<PostPurpose>("show");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [commentsAllowed, setCommentsAllowed] = useState(true);
  const [squadId, setSquadId] = useState("");
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [historyId, setHistoryId] = useState("");
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [gachaNote, setGachaNote] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(processed?.blob ?? null);

  const squads = useMemo(() => {
    try {
      return listSquadEntries();
    } catch {
      return [];
    }
  }, []);
  const history = useMemo(() => {
    try {
      return readDiagnosisHistory().entries;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const dirty = Boolean(file || body.trim() || processed);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // 画像の作り直し（ファイル・回転・トリミングが変わるたび）。前の処理は中断する。
  useEffect(() => {
    if (!file) {
      setProcessed(null);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("processing");
    setMessage(null);
    void (async () => {
      let cropRect: { x: number; y: number; width: number; height: number } | null = null;
      if (crop === "square") {
        try {
          const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
          const side = Math.min(bmp.width, bmp.height);
          cropRect = { x: Math.floor((bmp.width - side) / 2), y: Math.floor((bmp.height - side) / 2), width: side, height: side };
          bmp.close();
        } catch {
          cropRect = null;
        }
      }
      const r = await processPostImage(file, { rotation, crop: cropRect, signal: ac.signal });
      if (ac.signal.aborted) return;
      setPhase("idle");
      if (r.ok) setProcessed(r.image);
      else {
        setProcessed(null);
        setMessage({ tone: "error", text: lp(FAILURE_KEY[r.reason]) });
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, rotation, crop]);

  async function choose(f: File | null | undefined) {
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    if (!f) return;
    setPhase("checking");
    const c = await checkSelectedFile(f);
    setPhase("idle");
    if (!c.ok) {
      setMessage({ tone: "error", text: lp(FAILURE_KEY[c.reason]) });
      return;
    }
    setRotation(0);
    setCrop("none");
    setFile(f);
  }

  function resetForm() {
    setFile(null);
    setProcessed(null);
    setBody("");
    setAlt("");
    setSquadId("");
    setCardIds([]);
    setHistoryId("");
    setBeforeId("");
    setAfterId("");
    setGachaNote("");
    setDraftId(null);
    setVisibility("private");
    setCommentsAllowed(true);
  }

  function links(): PostLinks {
    const sq = squads.find((s) => s.squadId === squadId);
    const h = history.find((e) => e.id === historyId);
    return {
      ...EMPTY_LINKS,
      squadId: sq ? sq.squadId : null,
      managerId: sq?.managerId != null ? String(sq.managerId) : null,
      worldCardIds: cardIds.slice(0, POST_LIMITS.maxLinkedCards),
      diagnosisToken: h ? encodeSharePayload(h.payload) : null,
      gachaNote: gachaNote.trim() ? gachaNote.trim().slice(0, 120) : null,
      beforeAfterHistoryIds: beforeId && afterId && beforeId !== afterId ? [beforeId, afterId] : null,
    };
  }

  async function submit(status: "draft" | "posted") {
    if (busyRef.current || phase !== "idle") return; // 二重投稿の防止
    busyRef.current = true;
    setPhase("saving");
    setMessage(null);
    try {
      const r = await store.save({
        status,
        category,
        purpose,
        visibility,
        commentsAllowed,
        body,
        links: links(),
        image: processed ? { blob: processed.blob, mime: processed.mime, width: processed.width, height: processed.height, alt: alt.trim() } : null,
        draftId,
      });
      if (r.ok) {
        setMessage({ tone: "ok", text: lp(status === "draft" ? "draftSaved" : "posted") });
        if (status === "posted") resetForm();
        else setDraftId(r.post.id);
        await onSaved();
      } else {
        const key: LpKey = r.reason === "too_soon" ? "errTooSoon" : r.reason === "hourly_limit" ? "errHourly" : r.reason === "body_too_long" ? "errBodyTooLong" : r.reason === "alt_too_long" ? "errAltTooLong" : r.reason === "empty" ? "errNothing" : r.reason === "storage_full" ? "errStorageFull" : "errSaveFailed";
        setMessage({ tone: "error", text: lp(key) });
      }
    } catch {
      setMessage({ tone: "error", text: lp("errSaveFailed") });
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  }

  function loadDraft(d: LocalPost) {
    setDraftId(d.id);
    setBody(d.body);
    setAlt(d.image?.alt ?? "");
    setCategory(d.category);
    setPurpose(d.purpose);
    setVisibility(d.visibility);
    setCommentsAllowed(d.commentsAllowed);
    setSquadId(d.links.squadId ?? "");
    setCardIds(d.links.worldCardIds);
    setGachaNote(d.links.gachaNote ?? "");
    setFile(null);
    setProcessed(null);
    setMessage({ tone: "ok", text: lp("draftLoaded") });
  }

  const busy = phase !== "idle";
  return (
    <Surface padding="md" className="flex flex-col gap-3" data-testid="post-composer">
      <h2 className="text-sm font-semibold">{lp("composeHeading")}</h2>
      {!online ? <p className="text-xs text-text-muted" role="status">{lp("offlineNote")}</p> : null}
      {drafts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-text-dim">{lp("draftsLabel")}</span>
          {drafts.slice(0, 5).map((d) => (
            <button key={d.id} type="button" onClick={() => loadDraft(d)} className="min-h-[36px] rounded border border-border px-2 hover:border-accent" data-testid="draft-load">
              {(d.body.trim() || lp("untitledDraft")).slice(0, 20)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-md border border-accent bg-accent/10 px-3 text-sm font-semibold">
          {lp("cameraButton")}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} disabled={busy} data-testid="post-camera" />
        </label>
        <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:border-accent">
          {lp("libraryButton")}
          <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} disabled={busy} data-testid="post-library" />
        </label>
      </div>
      <p className="text-2xs text-text-muted">{lp("formatNote")}</p>

      {phase === "checking" || phase === "processing" ? (
        <div className="flex items-center gap-2 text-xs" role="status" aria-live="polite" data-testid="post-processing">
          <span>{lp(phase === "checking" ? "checking" : "processing")}</span>
          {phase === "processing" ? (
            <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => { abortRef.current?.abort(); setFile(null); setPhase("idle"); setMessage({ tone: "error", text: lp("errAborted") }); }}>
              {lp("cancelProcessing")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {previewUrl && processed ? (
        <div className="flex flex-col gap-2" data-testid="post-preview">
          <div className="flex max-w-full justify-center overflow-hidden rounded bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- この端末で作った画像のプレビュー */}
            <img src={previewUrl} alt={alt || lp("previewAlt")} className="h-auto max-h-[50vh] w-auto max-w-full" data-width={processed.width} data-height={processed.height} />
          </div>
          <p className="text-2xs text-text-muted" data-testid="post-image-info">
            {lp("imageInfoTemplate").replace("{w}", String(processed.width)).replace("{h}", String(processed.height)).replace("{kb}", String(Math.round(processed.blob.size / 1024)))}
          </p>
          <p role="note" className="rounded border border-border bg-surface-2/40 px-2 py-1.5 text-2xs text-text-dim" data-testid="post-privacy-note">
            {lp("privacyCheck")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="secondary" className="min-h-[44px]" onClick={() => setRotation((r) => (((r + 270) % 360) as Rotation))} disabled={busy}>
              {lp("rotateLeft")}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="min-h-[44px]" onClick={() => setRotation((r) => (((r + 90) % 360) as Rotation))} disabled={busy} data-testid="post-rotate-right">
              {lp("rotateRight")}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="min-h-[44px]" onClick={() => setCrop((c) => (c === "none" ? "square" : "none"))} disabled={busy} aria-pressed={crop === "square"} data-testid="post-crop-square">
              {lp("cropSquare")}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => { setFile(null); setProcessed(null); }} disabled={busy} data-testid="post-remove-image">
              {lp("removeImage")}
            </Button>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            {lp("altLabel")}
            <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={POST_LIMITS.altMax} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm" data-testid="post-alt" />
          </label>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-xs">
        {lp("bodyLabel")}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={POST_LIMITS.bodyMax} rows={4} className="rounded border border-border bg-surface px-2 py-1.5 text-sm" data-testid="post-body" />
        <span className="self-end text-2xs text-text-muted">{body.length} / {POST_LIMITS.bodyMax}</span>
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          {lp("categoryLabel")}
          <select value={category} onChange={(e) => setCategory(e.target.value as PostCategory)} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{lp(`cat_${c}` as LpKey)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {lp("purposeLabel")}
          <select value={purpose} onChange={(e) => setPurpose(e.target.value as PostPurpose)} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm">
            {PURPOSES.map((p) => (
              <option key={p} value={p}>{lp(`purpose_${p}` as LpKey)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {lp("squadLabel")}
          <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm">
            <option value="">{lp("none")}</option>
            {squads.map((s) => (
              <option key={s.squadId} value={s.squadId}>{s.squadName}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {lp("diagnosisLabel")}
          <select value={historyId} onChange={(e) => setHistoryId(e.target.value)} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm">
            <option value="">{lp("none")}</option>
            {history.map((h) => (
              <option key={h.id} value={h.id}>{`${h.squadLabel} ${h.payload.d} ${h.payload.o[0] ?? "—"}`}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {lp("beforeLabel")}
          <select value={beforeId} onChange={(e) => setBeforeId(e.target.value)} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm">
            <option value="">{lp("none")}</option>
            {history.map((h) => (
              <option key={h.id} value={h.id}>{`${h.squadLabel} ${h.payload.d}`}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {lp("afterLabel")}
          <select value={afterId} onChange={(e) => setAfterId(e.target.value)} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm">
            <option value="">{lp("none")}</option>
            {history.map((h) => (
              <option key={h.id} value={h.id}>{`${h.squadLabel} ${h.payload.d}`}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          {lp("gachaLabel")}
          <input value={gachaNote} onChange={(e) => setGachaNote(e.target.value)} maxLength={120} className="min-h-[44px] rounded border border-border bg-surface px-2 text-sm" />
        </label>
      </div>
      {myTeam.length > 0 ? (
        <fieldset className="text-xs">
          <legend className="mb-1">{lp("cardsLabel")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {myTeam.slice(0, 30).map((r) => {
              const on = cardIds.includes(r.worldCardId);
              return (
                <button key={r.worldCardId} type="button" aria-pressed={on} onClick={() => setCardIds((ids) => (on ? ids.filter((x) => x !== r.worldCardId) : ids.length < POST_LIMITS.maxLinkedCards ? [...ids, r.worldCardId] : ids))} className={`min-h-[36px] rounded border px-2 ${on ? "border-accent bg-accent/15" : "border-border"}`}>
                  {r.worldCardId}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="text-xs">
        <legend className="mb-1">{lp("visibilityLabel")}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {VISIBILITIES.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className={`min-h-[44px] rounded border px-3 ${visibility === v ? "border-accent bg-accent/15 font-semibold" : "border-border text-text-dim"}`} data-visibility={v}>
              {lp(`vis_${v}` as LpKey)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-2xs text-warning">{lp("visibilityMockNote")}</p>
      </fieldset>
      <label className="flex min-h-[44px] items-center gap-2 text-xs">
        <input type="checkbox" checked={commentsAllowed} onChange={(e) => setCommentsAllowed(e.target.checked)} />
        {lp("commentsAllowed")}
      </label>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur">
        <Button type="button" size="sm" className="min-h-[44px]" onClick={() => void submit("posted")} disabled={busy} data-testid="post-submit">
          {phase === "saving" ? lp("saving") : lp("postButton")}
        </Button>
        <Button type="button" size="sm" variant="secondary" className="min-h-[44px]" onClick={() => void submit("draft")} disabled={busy} data-testid="post-draft">
          {lp("draftButton")}
        </Button>
      </div>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} aria-live="polite" className={`text-xs ${message.tone === "error" ? "text-danger" : "text-success"}`} data-testid="post-message">
          {message.text}
        </p>
      ) : null}
    </Surface>
  );
}

function PostCard({ store, post, lp, onDelete }: { store: PostStore; post: LocalPost; lp: (k: LpKey) => string; onDelete: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [zoom, setZoom] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let alive = true;
    void store.image(post).then((b) => alive && setBlob(b));
    return () => {
      alive = false;
    };
  }, [store, post]);
  const url = useObjectUrl(blob);
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3" data-testid="my-post" data-status={post.status}>
      <div className="flex flex-wrap items-center gap-1.5 text-2xs">
        <Badge tone={post.status === "draft" ? "outline" : "neutral"} size="xs">{lp(post.status === "draft" ? "statusDraft" : "statusPosted")}</Badge>
        <Badge tone="outline" size="xs">{lp(`vis_${post.visibility}` as LpKey)}</Badge>
        <Badge tone="outline" size="xs">{lp(`cat_${post.category}` as LpKey)}</Badge>
        <span className="text-text-muted">{post.createdAt.slice(0, 16).replace("T", " ")}</span>
      </div>
      {url && post.image ? (
        <button type="button" onClick={() => setZoom(true)} className="flex max-w-full justify-center overflow-hidden rounded bg-black/40" aria-label={lp("zoomImage")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- この端末に保存した画像 */}
          <img src={url} alt={post.image.alt || lp("noAlt")} className="h-auto max-h-64 w-auto max-w-full" data-testid="my-post-image" />
        </button>
      ) : null}
      {post.body ? <p className="whitespace-pre-wrap break-words text-sm" data-user-content>{post.body}</p> : null}
      {post.links.squadId || post.links.diagnosisToken || post.links.worldCardIds.length > 0 ? (
        <p className="text-2xs text-text-muted">{lp("linkedSummary")}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => setConfirm(true)} data-testid="my-post-delete">{lp("deleteButton")}</Button>
      </div>
      {confirm ? (
        <div role="alertdialog" aria-label={lp("deleteConfirm")} className="rounded-md border border-danger/40 bg-danger/5 p-2 text-xs">
          <p>{lp("deleteConfirm")}</p>
          <div className="mt-1.5 flex gap-2">
            <Button type="button" size="sm" className="min-h-[44px]" onClick={onDelete} data-testid="my-post-delete-confirm">{lp("deleteButton")}</Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => setConfirm(false)}>{lp("cancel")}</Button>
          </div>
        </div>
      ) : null}
      {zoom && url ? (
        <div role="dialog" aria-modal="true" aria-label={lp("zoomImage")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3" onClick={() => setZoom(false)} data-testid="my-post-zoom">
          {/* eslint-disable-next-line @next/next/no-img-element -- 拡大表示 */}
          <img src={url} alt={post.image?.alt || lp("noAlt")} className="max-h-full max-w-full" />
          <button type="button" className="absolute end-3 top-3 min-h-[44px] min-w-[44px] rounded bg-surface/90 px-3 text-sm" onClick={() => setZoom(false)}>{lp("close")}</button>
        </div>
      ) : null}
    </li>
  );
}

function MyPosts({ store, posts, lp, onChanged, loadError }: { store: PostStore; posts: LocalPost[]; lp: (k: LpKey) => string; onChanged: () => Promise<void>; loadError: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Surface padding="md" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{lp("myPostsHeading")}</h2>
      {loadError ? <p role="alert" className="text-xs text-danger">{lp("errLoad")}</p> : null}
      {posts.length === 0 ? <p className="text-xs text-text-muted" data-testid="my-posts-empty">{lp("myPostsEmpty")}</p> : null}
      <ul className="flex flex-col gap-2" data-testid="my-posts">
        {posts.map((p) => (
          <PostCard
            key={p.id + p.updatedAt}
            store={store}
            post={p}
            lp={lp}
            onDelete={async () => {
              const r = await store.remove(p.id);
              setMsg(lp(r.ok ? "deleted" : "errDelete"));
              await onChanged();
            }}
          />
        ))}
      </ul>
      {msg ? <p role="status" className="text-xs text-text-dim">{msg}</p> : null}
    </Surface>
  );
}
