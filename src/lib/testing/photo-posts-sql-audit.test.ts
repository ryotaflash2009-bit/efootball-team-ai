import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { splitSqlStatements } from "./sql-statement-split";

/**
 * F-084 段階 2（本人だけの非公開投稿）の migration 提案の静的監査。実行は photo-posts-rls.postgres.test.ts（CI）。
 * Production へは適用していない（本人の承認後）。
 */
const DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const SQL = readFileSync(path.join(DIR, "create-photo-posts-stage2-schema.sql"), "utf8");
const ROLLBACK = readFileSync(path.join(DIR, "rollback-photo-posts-stage2-schema.sql"), "utf8");
const stmts = splitSqlStatements(SQL);
const policies = stmts.filter((s) => /^\s*create\s+policy\b/i.test(s));

describe("photo_posts 段階 2 の SQL（提案）", () => {
  it("photo_posts は RLS を有効化・強制し、監査ログも RLS 有効（ポリシーなし）", () => {
    expect(stmts.some((s) => /alter table public\.photo_posts enable row level security/i.test(s))).toBe(true);
    expect(stmts.some((s) => /alter table public\.photo_posts force row level security/i.test(s))).toBe(true);
    expect(stmts.some((s) => /alter table public\.photo_post_audit enable row level security/i.test(s))).toBe(true);
    expect(policies.some((p) => /on public\.photo_post_audit/i.test(p))).toBe(false);
  });

  it("ポリシーはすべて authenticated だけで、本人の条件（auth.uid()）を持ち、無条件の許可が無い", () => {
    expect(policies).toHaveLength(7);
    for (const p of policies) {
      expect(p).toMatch(/\bto authenticated\b/i);
      expect(p).not.toMatch(/\bto\s+(anon|public)\b/i);
      expect(p).not.toMatch(/(using|with check)\s*\(\s*true\s*\)/i);
      expect(p).toMatch(/auth\.uid\(\)/);
    }
    const table = policies.filter((p) => /on public\.photo_posts\b/i.test(p));
    expect(table.map((p) => /for (\w+)/i.exec(p)?.[1].toLowerCase()).sort()).toEqual(["delete", "insert", "select", "update"]);
    const update = table.find((p) => /for update/i.test(p))!;
    expect(update).toMatch(/using \(user_id = auth\.uid\(\)\)/i);
    expect(update).toMatch(/with check \(user_id = auth\.uid\(\)\)/i);
  });

  it("Storage: 非公開バケット・5 MB・JPEG/WebP、オブジェクトは所有者のフォルダーだけ（上書き用の UPDATE ポリシーなし）", () => {
    expect(SQL).toMatch(/values \('photo-posts', 'photo-posts', false, 5242880, array\['image\/jpeg', 'image\/webp'\]\)/);
    expect(SQL).toMatch(/do update\s+set public = false/);
    const objects = policies.filter((p) => /on storage\.objects/i.test(p));
    expect(objects.map((p) => /for (\w+)/i.exec(p)?.[1].toLowerCase()).sort()).toEqual(["delete", "insert", "select"]);
    for (const p of objects) {
      expect(p).toMatch(/bucket_id = 'photo-posts'/);
      expect(p).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    }
  });

  it("段階 2 では公開範囲を private に、コメントを無効に固定する（広げるのは別の承認つき migration）", () => {
    expect(SQL).toMatch(/constraint photo_posts_visibility_stage2 check \(visibility = 'private'\)/);
    expect(SQL).toMatch(/constraint photo_posts_comments_disabled check \(allow_comments = false\)/);
    expect(SQL).toMatch(/user_id uuid not null default auth\.uid\(\)/);
    expect(SQL).toMatch(/photo_posts_image_path_owner check \(image_path is null or split_part\(image_path, '\/', 1\) = user_id::text\)/);
  });

  it("anon・public へ GRANT しない。security definer は監査トリガーだけで search_path を固定", () => {
    for (const g of stmts.filter((s) => /^\s*grant\b/i.test(s))) expect(g).not.toMatch(/\bto\s+(anon|public)\b/i);
    const fns = stmts.filter((s) => /create or replace function/i.test(s));
    expect(fns).toHaveLength(2);
    for (const f of fns) expect(f).toMatch(/set search_path = ''/);
    expect(fns.filter((f) => /security definer/i.test(f)).map((f) => /function (\S+)\(/.exec(f)?.[1])).toEqual(["public.photo_posts_audit"]);
    expect(SQL).not.toMatch(/service_role|sb_secret_|(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]/);
    expect(SQL).not.toMatch(/\b(alter|drop|truncate)\s+table\s+auth\./i);
    expect(SQL).not.toMatch(/\bexecute\s+(format\s*\(|'|")/i);
  });

  it("監査ログに本文・画像の列を持たない", () => {
    const audit = stmts.find((s) => /create table if not exists public\.photo_post_audit/i.test(s))!;
    expect(audit).not.toMatch(/\b(body|image_path|image_alt)\b/);
  });

  it("rollback は作ったものだけを外し、Storage のオブジェクト・バケットは SQL で消さない", () => {
    expect(ROLLBACK).toMatch(/drop table if exists public\.photo_posts;/);
    expect(ROLLBACK).not.toMatch(/delete\s+from\s+storage\./i);
    expect(ROLLBACK).not.toMatch(/drop\s+(table|schema)\s+[^;]*storage/i);
    for (const name of ["photo_posts_objects_select_own", "photo_posts_objects_insert_own", "photo_posts_objects_delete_own"]) expect(ROLLBACK).toContain(name);
  });
});
