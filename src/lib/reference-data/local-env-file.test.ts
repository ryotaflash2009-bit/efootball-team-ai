import { describe, it, expect } from "vitest";
import { extractSupabaseUrlFromEnvFileContent } from "./local-env-file";

describe("extractSupabaseUrlFromEnvFileContent", () => {
  it("素のURL行から値を取り出す", () => {
    expect(extractSupabaseUrlFromEnvFileContent("NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\n")).toBe("https://abc.supabase.co");
  });

  it("他の行に混じっていても取り出す", () => {
    const content = ["# comment", "SOME_OTHER=1", "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx"].join(
      "\n",
    );
    expect(extractSupabaseUrlFromEnvFileContent(content)).toBe("https://abc.supabase.co");
  });

  it("二重引用符・単一引用符を1回だけ剥がす", () => {
    expect(extractSupabaseUrlFromEnvFileContent('NEXT_PUBLIC_SUPABASE_URL="https://abc.supabase.co"')).toBe("https://abc.supabase.co");
    expect(extractSupabaseUrlFromEnvFileContent("NEXT_PUBLIC_SUPABASE_URL='https://abc.supabase.co'")).toBe("https://abc.supabase.co");
  });

  it("行が存在しなければnull", () => {
    expect(extractSupabaseUrlFromEnvFileContent("SOME_OTHER=1\n")).toBeNull();
  });

  it("値が空ならnull", () => {
    expect(extractSupabaseUrlFromEnvFileContent("NEXT_PUBLIC_SUPABASE_URL=\n")).toBeNull();
  });

  it("前後の空白を除去する", () => {
    expect(extractSupabaseUrlFromEnvFileContent("NEXT_PUBLIC_SUPABASE_URL=  https://abc.supabase.co  \n")).toBe("https://abc.supabase.co");
  });

  it("publishable keyや他の秘密情報が混じっていても、URL以外の値は返さない", () => {
    const content = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_should_not_be_returned\nNEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co";
    const result = extractSupabaseUrlFromEnvFileContent(content);
    expect(result).toBe("https://abc.supabase.co");
    expect(result).not.toContain("sb_publishable");
  });
});
