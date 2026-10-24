import { describe, expect, it } from "vitest";
import { tierRedirectTarget } from "./tier-redirect";

describe("ティアリストの転送（2026-10-24）", () => {
  it("/tier と ?position= は大文字・小文字を問わず /tier/XX へ（知らない値は CF）", () => {
    expect(tierRedirectTarget("/tier", null)).toBe("/tier/CF");
    expect(tierRedirectTarget("/tier", "gk")).toBe("/tier/GK");
    expect(tierRedirectTarget("/tier/", "AMF")).toBe("/tier/AMF");
    expect(tierRedirectTarget("/tier", "xx")).toBe("/tier/CF");
  });
  it("/tier/cf などの小文字は大文字へ。正しい URL・知らない値・ほかの画面は転送しない", () => {
    expect(tierRedirectTarget("/tier/cf", null)).toBe("/tier/CF");
    expect(tierRedirectTarget("/tier/CF", null)).toBeNull();
    expect(tierRedirectTarget("/tier/xx", null)).toBeNull();
    expect(tierRedirectTarget("/tier-pack-preview", null)).toBeNull();
    expect(tierRedirectTarget("/players", "CF")).toBeNull();
  });
});
