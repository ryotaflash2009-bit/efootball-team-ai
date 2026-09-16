/**
 * `.env.local`ファイルのテキストから`NEXT_PUBLIC_SUPABASE_URL`の値だけを取り出す純関数。
 *
 * このモジュール自体はファイルを読み込まない(呼び出し側がfsで読み込んだ文字列を渡す)。
 * `NEXT_PUBLIC_SUPABASE_URL`はクライアントへ公開済みの非秘密値であり、publishable key・
 * DBパスワード・service_role等の秘密情報はこのモジュールでは一切取り扱わない。
 */
const SUPABASE_URL_LINE_RE = /^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)$/m;

export function extractSupabaseUrlFromEnvFileContent(content: string): string | null {
  const match = content.match(SUPABASE_URL_LINE_RE);
  if (!match) return null;
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value || null;
}
