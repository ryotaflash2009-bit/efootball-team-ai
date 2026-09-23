import { CURRENT_BACKUP_FORMAT_VERSION, getBackupTableSpec, type BackupFormatVersion, type BackupTableSpec, type BackupIsolatedSchemaName, type BackupDumpSourceSchemaName } from "./backup-schema";
import { BACKUP_SOURCE_TEST_SCHEMA, BACKUP_RESTORE_TEST_SCHEMA, PRODUCTION_REFERENCE_DATA_SCHEMA } from "./backup-schema";
import { BACKUP_TARGET_TABLES } from "./backup-target";

/**
 * Backup/Restore専用のSQL文字列組み立て(SELECT/INSERT/COUNTのみ)。
 *
 * `promotion-sql.ts`と同じ規約: 列名は`BackupTableSpec.columns`から生成し、`SELECT *`は
 * 使わない。パラメータは`?`プレースホルダーで組み立て、`createPostgresQueryClient`の
 * `?`→`$n`変換にそのまま渡せる形にする。schema名は`BackupIsolatedSchemaName`
 * (固定2値のunion)以外を受け付けない。
 */

function assertIsolatedSchema(schemaName: BackupIsolatedSchemaName): void {
  if (schemaName !== BACKUP_SOURCE_TEST_SCHEMA && schemaName !== BACKUP_RESTORE_TEST_SCHEMA) {
    throw new Error(`許可されていない隔離schema名: ${schemaName}`);
  }
}

/** dump(読み出し)専用: 隔離検証2schemaに加え、実Production `reference_data`からの読み出しだけを許可する。 */
function assertDumpSourceSchema(schemaName: BackupDumpSourceSchemaName): void {
  if (schemaName !== BACKUP_SOURCE_TEST_SCHEMA && schemaName !== BACKUP_RESTORE_TEST_SCHEMA && schemaName !== PRODUCTION_REFERENCE_DATA_SCHEMA) {
    throw new Error(`許可されていないdump元schema名: ${schemaName}`);
  }
}

export function buildBackupDumpSelectSql(schemaName: BackupDumpSourceSchemaName, table: string, version: BackupFormatVersion = CURRENT_BACKUP_FORMAT_VERSION): string {
  assertDumpSourceSchema(schemaName);
  const spec = getBackupTableSpec(table, version);
  return `select ${spec.columns.join(", ")} from ${schemaName}.${table} order by ${spec.primaryKey}`;
}

export function buildBackupCountSql(schemaName: BackupIsolatedSchemaName, table: string): string {
  assertIsolatedSchema(schemaName);
  getBackupTableSpec(table);
  return `select count(*) as count from ${schemaName}.${table}`;
}

/**
 * Restore先(常に固定の`BACKUP_RESTORE_TEST_SCHEMA`)の対象4テーブルすべてを、
 * **単一のTRUNCATE文**でまとめて空にする。
 *
 * 1テーブルずつ別々のTRUNCATE文で呼び出してはならない: `player_card_analysis`は
 * `world_player_cards`を外部キー参照しており、PostgreSQLは「参照されているテーブルを、
 * 参照元テーブルも同一TRUNCATE文に含めない限り単独でTRUNCATEすることを拒否する」
 * (参照元テーブルが既に空か・既に別文でTRUNCATE済みかは無関係、制約カタログ上の
 * 関係だけで判定される)。テーブルを引数で選べない設計にしているのはこの制約のため。
 */
export function buildBackupTruncateAllRestoreTargetsSql(): string {
  const qualified = BACKUP_TARGET_TABLES.map((table) => {
    getBackupTableSpec(table);
    return `${BACKUP_RESTORE_TEST_SCHEMA}.${table}`;
  });
  return `truncate table ${qualified.join(", ")}`;
}

export function buildBackupRestoreInsertSql(table: string, rowCount: number, version: BackupFormatVersion = CURRENT_BACKUP_FORMAT_VERSION): string {
  const spec = getBackupTableSpec(table, version);
  if (rowCount <= 0) throw new Error("buildBackupRestoreInsertSql: rowCountは1以上である必要がある");
  const valueRows: string[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    valueRows.push(`(${spec.columns.map(() => "?").join(", ")})`);
  }
  return `insert into ${BACKUP_RESTORE_TEST_SCHEMA}.${table} (${spec.columns.join(", ")}) values ${valueRows.join(", ")}`;
}

/** 書込みパラメータへの変換(Promotionの`mapFieldsToParams`と同じ規約): jsonb列だけJSON.stringifyし、text[]列を含むそれ以外はそのまま渡す。 */
export function mapBackupFieldsToParams(spec: BackupTableSpec, fields: Readonly<Record<string, unknown>>): unknown[] {
  return spec.columns.map((col) => {
    const value = fields[col] ?? null;
    if (value === null) return null;
    if (spec.jsonbColumns.includes(col)) return JSON.stringify(value);
    return value;
  });
}

/**
 * DB読み出し結果(`QueryClient`経由、`postgres-adapter.ts`の`normalizeRow`によりjsonb・配列列は
 * いずれもJSON文字列化されている想定)を、Backupファイルへ書き出すための「移植可能な論理値」に
 * 変換する。jsonb・text[]いずれの列も、文字列化されていれば`JSON.parse`で元の構造(object/array)
 * へ戻す。これは書込み時の型判別(`mapBackupFieldsToParams`のjsonb列だけ再度JSON.stringifyする
 * 規約)とは非対称だが、読み出し時は「文字列ならパースして構造化値に戻す」だけでよく、
 * jsonbかtext[]かを判別する必要がない(`JSON.parse`の結果はどちらも同じ形になるため)。
 */
export function toPortableBackupRow(spec: BackupTableSpec, row: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of spec.columns) {
    const value = row[col] ?? null;
    if (typeof value === "string" && (spec.jsonbColumns.includes(col) || isLikelyJsonArrayColumn(spec, col))) {
      try {
        out[col] = JSON.parse(value);
        continue;
      } catch {
        // JSONとして解釈できない通常の文字列列(name_en等)は、そのまま保持する。
      }
    }
    out[col] = value;
  }
  return out;
}

const KNOWN_ARRAY_COLUMNS = new Set(["skills", "ai_styles", "com_skills", "player_skills"]);
function isLikelyJsonArrayColumn(_spec: BackupTableSpec, col: string): boolean {
  return KNOWN_ARRAY_COLUMNS.has(col);
}
