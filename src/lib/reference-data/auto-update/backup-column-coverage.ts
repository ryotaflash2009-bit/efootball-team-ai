import { BACKUP_RESTORE_TEST_SCHEMA, getBackupTableSpec, type BackupFormatVersion } from "./backup-schema";
import { BACKUP_TARGET_TABLES } from "./backup-target";

/**
 * Backup形式"2"で追加した列(Stage 3: Backup v2初回実行の確認対象)が、実際にBackupへ収録され、
 * 隔離Restore後も値が残っていることを、秘密情報・行データを含まない集計値だけで示す。
 *
 * - 集計は、このjob専用の隔離PostgreSQL(Restore先の検証schema)だけに対して行う。Productionへは追加の照会をしない。
 * - 出力は列名・列数・行数・非null件数だけ(値そのものは出さない)。
 */

export interface QueryClientLike {
  query(sql: string, params?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** 形式"2"で追加した列(`table.column`)。形式"1"と"2"の列集合の差から求める(手書きの一覧と食い違わない)。 */
export const BACKUP_V2_ADDED_COLUMNS: readonly string[] = Object.freeze(
  BACKUP_TARGET_TABLES.flatMap((t) => {
    const v1 = getBackupTableSpec(t, "1").columns;
    return getBackupTableSpec(t, "2").columns.filter((c) => !v1.includes(c)).map((c) => `${t}.${c}`);
  }),
);

export interface AddedColumnCoverage {
  readonly included: boolean;
  readonly rows: number;
  readonly nonNullRows: number;
}

export interface BackupColumnCoverage {
  readonly formatVersion: BackupFormatVersion;
  readonly columnCounts: Readonly<Record<string, number>>;
  readonly addedColumns: Readonly<Record<string, AddedColumnCoverage>>;
}

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

/** 隔離Restore先の1 tableについて、行数と指定列の非null件数を数えるSQL(識別子は固定の列定義から来る)。 */
export function buildColumnCoverageSql(table: string, columns: readonly string[]): string {
  for (const id of [table, ...columns]) if (!IDENT_RE.test(id)) throw new Error("coverage対象の識別子が不正(blocked)");
  const counts = columns.map((c) => `count("${c}")::int as "${c}"`);
  return `select count(*)::int as "__rows"${counts.map((c) => `, ${c}`).join("")} from ${BACKUP_RESTORE_TEST_SCHEMA}.${table}`;
}

const toInt = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("coverage集計値が不正(blocked)");
  return n;
};

/** Restore済みの隔離schemaを集計する。版"1"では追加列は収録されない(included=false、件数は0)。 */
export async function measureBackupColumnCoverage(client: QueryClientLike, version: BackupFormatVersion): Promise<BackupColumnCoverage> {
  const columnCounts: Record<string, number> = {};
  const addedColumns: Record<string, AddedColumnCoverage> = {};
  for (const table of BACKUP_TARGET_TABLES) {
    const spec = getBackupTableSpec(table, version);
    columnCounts[table] = spec.columns.length;
    const added = BACKUP_V2_ADDED_COLUMNS.filter((k) => k.startsWith(`${table}.`)).map((k) => k.slice(table.length + 1));
    const present = added.filter((c) => spec.columns.includes(c));
    const row = (await client.query(buildColumnCoverageSql(table, present))).rows[0] ?? {};
    const rows = toInt(row.__rows);
    for (const c of added) {
      const included = present.includes(c);
      addedColumns[`${table}.${c}`] = { included, rows, nonNullRows: included ? toInt(row[c]) : 0 };
    }
  }
  return { formatVersion: version, columnCounts, addedColumns };
}
