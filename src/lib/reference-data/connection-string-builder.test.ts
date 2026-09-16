import { describe, it, expect } from "vitest";
import {
  PASSWORD_PLACEHOLDER,
  countPlaceholderOccurrences,
  checkExactlyOnePlaceholder,
  checkNonEmpty,
  encodePasswordForUri,
  substitutePlaceholderOnce,
  validateConnectionStringStructure,
  buildAndValidateConnectionString,
  extractProjectRefFromSupabaseUrl,
  checkTemplateMatchesProjectRef,
} from "./connection-string-builder";

const SESSION_POOLER_TEMPLATE = `postgresql://postgres.example-ref:${PASSWORD_PLACEHOLDER}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`;
const TRANSACTION_POOLER_TEMPLATE = `postgresql://postgres.example-ref:${PASSWORD_PLACEHOLDER}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
const DIRECT_TEMPLATE = `postgresql://postgres:${PASSWORD_PLACEHOLDER}@db.example-ref.supabase.co:5432/postgres`;

describe("countPlaceholderOccurrences / checkExactlyOnePlaceholder", () => {
  it("プレースホルダーがちょうど1件ならok", () => {
    expect(countPlaceholderOccurrences(SESSION_POOLER_TEMPLATE)).toBe(1);
    expect(checkExactlyOnePlaceholder(1)).toEqual({ ok: true });
  });
  it("0件は拒否", () => {
    expect(checkExactlyOnePlaceholder(0).ok).toBe(false);
  });
  it("2件以上は拒否", () => {
    const twice = SESSION_POOLER_TEMPLATE + PASSWORD_PLACEHOLDER;
    expect(countPlaceholderOccurrences(twice)).toBe(2);
    expect(checkExactlyOnePlaceholder(2).ok).toBe(false);
  });
});

describe("checkNonEmpty", () => {
  it("空文字・空白のみ・null・undefinedはNG", () => {
    expect(checkNonEmpty("", "テンプレート").ok).toBe(false);
    expect(checkNonEmpty("   ", "テンプレート").ok).toBe(false);
    expect(checkNonEmpty(null, "テンプレート").ok).toBe(false);
    expect(checkNonEmpty(undefined, "テンプレート").ok).toBe(false);
  });
  it("非空文字列はok", () => {
    expect(checkNonEmpty("x", "テンプレート")).toEqual({ ok: true });
  });
});

describe("encodePasswordForUri", () => {
  it("予約文字を安全にエンコードする", () => {
    const encoded = encodePasswordForUri("p@ss:w/ord?#&% 1");
    expect(encoded).not.toContain("@");
    expect(encoded).not.toContain(":");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("?");
    expect(encoded).not.toContain("#");
    expect(encoded).not.toContain("&");
    expect(encoded).not.toContain(" ");
  });

  it("encodeURIComponentが素通りする! ' ( ) * も追加でエンコードする", () => {
    const encoded = encodePasswordForUri("a!b'c(d)e*f");
    expect(encoded).not.toMatch(/[!'()*]/);
  });

  it("英数字だけのパスワードは変化しない", () => {
    expect(encodePasswordForUri("simplePassword123")).toBe("simplePassword123");
  });

  it("一度エンコードした結果を再エンコードしても元のパスワードへ正しく戻せる(二重エンコードの検出)", () => {
    const original = "p@ss word/with?special#chars";
    const encodedOnce = encodePasswordForUri(original);
    // 1回のデコードで元に戻ることを確認する = 実際に1回しかエンコードしていない証拠
    expect(decodeURIComponent(encodedOnce)).toBe(original);
  });
});

describe("substitutePlaceholderOnce", () => {
  it("プレースホルダーを置換する", () => {
    const result = substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE, "ENCODED");
    expect(result).toBe(`postgresql://postgres.example-ref:ENCODED@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`);
  });
  it("プレースホルダーが0件なら例外", () => {
    expect(() => substitutePlaceholderOnce("no placeholder here", "x")).toThrow();
  });
  it("プレースホルダーが2件以上なら例外", () => {
    expect(() => substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE + PASSWORD_PLACEHOLDER, "x")).toThrow();
  });
});

describe("validateConnectionStringStructure", () => {
  it("Session pooler形式(ポート5432)はok", () => {
    const result = validateConnectionStringStructure(substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE, "dummy-encoded-password"));
    expect(result.ok).toBe(true);
    expect(result.poolerType).toBe("session");
  });

  it("Transaction pooler形式(ポート6543)は拒否", () => {
    const result = validateConnectionStringStructure(substitutePlaceholderOnce(TRANSACTION_POOLER_TEMPLATE, "dummy"));
    expect(result.ok).toBe(false);
    expect(result.poolerType).toBe("transaction");
  });

  it("Direct connection形式は拒否", () => {
    const result = validateConnectionStringStructure(substitutePlaceholderOnce(DIRECT_TEMPLATE, "dummy"));
    expect(result.ok).toBe(false);
    expect(result.poolerType).toBe("direct");
  });

  it("URI解析に失敗する文字列は拒否", () => {
    const result = validateConnectionStringStructure("not a valid uri at all");
    expect(result.ok).toBe(false);
  });

  it("db名がpostgres以外なら拒否", () => {
    const wrongDb = `postgresql://postgres.example-ref:dummy@aws-0-ap-northeast-1.pooler.supabase.com:5432/not-postgres`;
    expect(validateConnectionStringStructure(wrongDb).ok).toBe(false);
  });

  it("エラー理由に入力文字列そのもの(ホスト名等)を含めない", () => {
    const wrongDb = `postgresql://postgres.example-ref:dummy@aws-0-ap-northeast-1.pooler.supabase.com:5432/not-postgres`;
    const result = validateConnectionStringStructure(wrongDb);
    expect(result.reason).not.toContain("aws-0-ap-northeast-1");
    expect(result.reason).not.toContain("example-ref");
  });

  it("Direct connectionの拒否理由には、Session poolerタブを選び直す具体的な案内を含む", () => {
    const result = validateConnectionStringStructure(substitutePlaceholderOnce(DIRECT_TEMPLATE, "dummy"));
    expect(result.reason).toMatch(/Session pooler.*タブ/);
  });

  it("Transaction poolerの拒否理由には、Session poolerタブを選び直す具体的な案内を含む", () => {
    const result = validateConnectionStringStructure(substitutePlaceholderOnce(TRANSACTION_POOLER_TEMPLATE, "dummy"));
    expect(result.reason).toMatch(/Session pooler.*タブ/);
  });

  it("前後に空白が付いていてもSession pooler形式を正しく認識する(URI仕様で自動除去される)", () => {
    const withSpaces = `  ${substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE, "dummy")}  `;
    const result = validateConnectionStringStructure(withSpaces);
    expect(result.ok).toBe(true);
    expect(result.poolerType).toBe("session");
  });

  it("途中に改行・タブが混入していてもSession pooler形式を正しく認識する(URI仕様で自動除去される)", () => {
    const raw = substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE, "dummy");
    const withNewline = raw.replace("dummy@", "dum\nmy@");
    const withTab = raw.replace(":5432", "\t:5432");
    expect(validateConnectionStringStructure(withNewline).poolerType).toBe("session");
    expect(validateConnectionStringStructure(withTab).poolerType).toBe("session");
  });

  it("前後を引用符で囲まれた文字列は、Direct/Session誤判定ではなく明確なURI解析失敗として拒否される", () => {
    const quoted = `"${substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE, "dummy")}"`;
    const result = validateConnectionStringStructure(quoted);
    expect(result.ok).toBe(false);
    expect(result.poolerType).toBeUndefined();
    expect(result.reason).toMatch(/URI解析に失敗/);
  });
});

describe("extractProjectRefFromSupabaseUrl", () => {
  it("https://<ref>.supabase.co からproject refを取り出す", () => {
    expect(extractProjectRefFromSupabaseUrl("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
  });
  it("supabase.co以外のホストはnull", () => {
    expect(extractProjectRefFromSupabaseUrl("https://example.com")).toBeNull();
  });
  it("不正なURLはnull", () => {
    expect(extractProjectRefFromSupabaseUrl("not a url")).toBeNull();
  });
});

describe("checkTemplateMatchesProjectRef", () => {
  const sessionCs = substitutePlaceholderOnce(SESSION_POOLER_TEMPLATE, "dummy"); // ref = example-ref
  const directCs = substitutePlaceholderOnce(DIRECT_TEMPLATE, "dummy"); // ref = example-ref

  it("Session poolerのユーザー名部分のrefが一致すればok", () => {
    expect(checkTemplateMatchesProjectRef(sessionCs, "example-ref").ok).toBe(true);
  });
  it("Direct connectionのホスト名部分のrefが一致すればok", () => {
    expect(checkTemplateMatchesProjectRef(directCs, "example-ref").ok).toBe(true);
  });
  it("refが不一致なら拒否する(理由にref実値を含めない)", () => {
    const result = checkTemplateMatchesProjectRef(sessionCs, "totally-different-ref");
    expect(result.ok).toBe(false);
    expect(result.reason).not.toContain("example-ref");
    expect(result.reason).not.toContain("totally-different-ref");
  });
  it("期待値が未指定(null/undefined)ならスキップしてok(誤検知回避)", () => {
    expect(checkTemplateMatchesProjectRef(sessionCs, null).ok).toBe(true);
    expect(checkTemplateMatchesProjectRef(sessionCs, undefined).ok).toBe(true);
  });
  it("大文字小文字の違いは同一とみなす", () => {
    expect(checkTemplateMatchesProjectRef(sessionCs, "EXAMPLE-REF").ok).toBe(true);
  });
});

describe("buildAndValidateConnectionString(統合エントリポイント)", () => {
  it("正常なSession poolerテンプレート+パスワードで成功し、connectionStringを返す", () => {
    const result = buildAndValidateConnectionString({ template: SESSION_POOLER_TEMPLATE, password: "p@ss:word/1" });
    expect(result.ok).toBe(true);
    expect(result.poolerType).toBe("session");
    expect(result.connectionString).toBeDefined();
    expect(result.connectionString).not.toContain(PASSWORD_PLACEHOLDER);
    expect(result.connectionString).not.toContain("p@ss:word/1"); // 生のパスワードのままでは含まれない(エンコード済み)
  });

  it("空テンプレートは失敗", () => {
    expect(buildAndValidateConnectionString({ template: "", password: "x" }).ok).toBe(false);
  });

  it("空パスワードは失敗", () => {
    expect(buildAndValidateConnectionString({ template: SESSION_POOLER_TEMPLATE, password: "" }).ok).toBe(false);
  });

  it("プレースホルダー0件は失敗", () => {
    const noPlaceholder = SESSION_POOLER_TEMPLATE.replace(PASSWORD_PLACEHOLDER, "already-a-password");
    expect(buildAndValidateConnectionString({ template: noPlaceholder, password: "x" }).ok).toBe(false);
  });

  it("プレースホルダー2件以上は失敗", () => {
    expect(buildAndValidateConnectionString({ template: SESSION_POOLER_TEMPLATE + PASSWORD_PLACEHOLDER, password: "x" }).ok).toBe(false);
  });

  it("完成済み(プレースホルダーが既に実パスワードに置き換わった)接続文字列がそのまま渡された場合、再入力を求めず安全に拒否する", () => {
    // ユーザーが誤って「パスワード入り」の完成済み接続文字列をtemplateとして渡した場合を模す
    const alreadyComplete = SESSION_POOLER_TEMPLATE.replace(PASSWORD_PLACEHOLDER, "actualSecretValue123");
    const result = buildAndValidateConnectionString({ template: alreadyComplete, password: "someOtherPassword" });
    expect(result.ok).toBe(false);
    // 理由は「プレースホルダーが見つからない」であり、入力値そのものは含まれない
    expect(result.reason).not.toContain("actualSecretValue123");
    expect(result.reason).not.toContain("someOtherPassword");
  });

  it("Transaction poolerテンプレートは失敗", () => {
    expect(buildAndValidateConnectionString({ template: TRANSACTION_POOLER_TEMPLATE, password: "x" }).ok).toBe(false);
  });

  it("Direct connectionテンプレートは失敗", () => {
    expect(buildAndValidateConnectionString({ template: DIRECT_TEMPLATE, password: "x" }).ok).toBe(false);
  });

  it("いかなる失敗時も理由に入力したパスワード・テンプレートの実値を含めない", () => {
    const result = buildAndValidateConnectionString({ template: DIRECT_TEMPLATE, password: "my-super-secret-password" });
    expect(JSON.stringify(result)).not.toContain("my-super-secret-password");
    expect(JSON.stringify(result)).not.toContain("db.example-ref.supabase.co");
  });

  it("expectedProjectRefが一致すれば成功する", () => {
    const result = buildAndValidateConnectionString({ template: SESSION_POOLER_TEMPLATE, password: "x", expectedProjectRef: "example-ref" });
    expect(result.ok).toBe(true);
  });

  it("expectedProjectRefが不一致なら、Session pooler形式でも拒否する(別プロジェクトの取り違え検出)", () => {
    const result = buildAndValidateConnectionString({ template: SESSION_POOLER_TEMPLATE, password: "x", expectedProjectRef: "some-other-project" });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("example-ref");
    expect(JSON.stringify(result)).not.toContain("some-other-project");
  });

  it("expectedProjectRefを省略した場合は、これまでどおりproject ref不一致では失敗しない", () => {
    const result = buildAndValidateConnectionString({ template: SESSION_POOLER_TEMPLATE, password: "x" });
    expect(result.ok).toBe(true);
  });
});
