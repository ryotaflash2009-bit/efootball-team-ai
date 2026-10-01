/**
 * F-041b: 画像を OS の共有（Web Share API・ファイル共有）へ渡し、使えない環境では端末へ保存する。
 *
 * - 共有シートを利用者が閉じた（AbortError）ときは「取り消し」として扱い、エラーにしない。
 * - ファイル共有に対応していない（canShare が false・share が無い）ときは、保存（ダウンロード）へ切り替える。
 * - Object URL は使い終わったら必ず解放する。
 */
export type ShareImageResult =
  | { ok: true; method: "share" | "download" }
  | { ok: false; reason: "cancelled" | "unsupported" | "error" };

export interface ShareEnv {
  navigator?: Partial<Pick<Navigator, "share" | "canShare">> | null;
  createFile?: (blob: Blob, name: string) => File;
  download?: (blob: Blob, filename: string) => boolean;
}

/** 端末へ保存する（一時的な <a download> と Object URL。後で必ず解放）。 */
export function downloadBlobFile(blob: Blob, filename: string): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    url = URL.createObjectURL(blob);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    if (anchor?.parentNode) anchor.parentNode.removeChild(anchor);
    if (url) {
      const u = url;
      setTimeout(() => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* noop */
        }
      }, 10_000);
    }
  }
}

/** この環境で画像ファイルの OS 共有を使えるか（ボタンの表示判定）。 */
export function canShareImageFiles(env: ShareEnv = {}): boolean {
  const nav = env.navigator ?? (typeof navigator !== "undefined" ? navigator : null);
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    const make = env.createFile ?? ((b: Blob, n: string) => new File([b], n, { type: "image/png" }));
    const probe = make(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "probe.png");
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareOrSaveImage(blob: Blob, filename: string, title: string, env: ShareEnv = {}): Promise<ShareImageResult> {
  const nav = env.navigator ?? (typeof navigator !== "undefined" ? navigator : null);
  const download = env.download ?? downloadBlobFile;
  const make = env.createFile ?? ((b: Blob, n: string) => new File([b], n, { type: "image/png" }));
  let file: File | null = null;
  try {
    file = make(blob, filename);
  } catch {
    file = null;
  }
  if (file && nav && typeof nav.share === "function" && typeof nav.canShare === "function") {
    let shareable = false;
    try {
      shareable = nav.canShare({ files: [file] });
    } catch {
      shareable = false;
    }
    if (shareable) {
      try {
        await nav.share({ files: [file], title });
        return { ok: true, method: "share" };
      } catch (e) {
        const name = (e as { name?: string } | null)?.name;
        if (name === "AbortError") return { ok: false, reason: "cancelled" };
        // 共有だけが失敗した（権限など）ときは保存へ切り替える。
      }
    }
  }
  return download(blob, filename) ? { ok: true, method: "download" } : { ok: false, reason: "unsupported" };
}
