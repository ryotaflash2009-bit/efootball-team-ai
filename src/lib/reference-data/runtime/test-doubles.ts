/**
 * `@supabase/supabase-js`のクエリビルダーを模した、実接続なしのテストダブル。
 *
 * PostgREST全体を再現する汎用エンジンではなく、`world-source.ts`/`managers-source.ts`/
 * `analysis-source.ts`が実際に発行する呼び出し形(eq/ilike/or/gte/lte/in/order/range/
 * maybeSingle/select+count)だけに対応する。実Supabaseへは一切接続しない。
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

interface Filter {
  field: string;
  op: string;
  value: unknown;
}

interface FakeResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count: number | null;
  status?: number;
}

function matchOne(row: Row, f: Filter): boolean {
  const v = row[f.field];
  switch (f.op) {
    case "eq":
      return String(v) === String(f.value);
    case "neq":
      return String(v) !== String(f.value);
    case "gte":
      return Number(v) >= Number(f.value);
    case "lte":
      return Number(v) <= Number(f.value);
    case "ilike": {
      const pattern = String(f.value).replace(/^%/, "").replace(/%$/, "");
      return typeof v === "string" && v.toLowerCase().includes(pattern.toLowerCase());
    }
    case "in":
      return Array.isArray(f.value) && f.value.map(String).includes(String(v));
    case "not.is":
      return f.value === null ? v != null : true;
    default:
      return true;
  }
}

function parseOrExpression(expr: string): Filter[] {
  // 例: "boost1.neq.0,boost2.neq.0"
  return expr.split(",").map((part) => {
    const [field, op, ...rest] = part.split(".");
    return { field, op, value: rest.join(".") };
  });
}

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private filters: Filter[] = [];
  private orGroups: Filter[][] = [];
  private orderKeys: { field: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private wantCount = false;
  private headOnly = false;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(private readonly rows: readonly Row[]) {}

  select(_columns?: string, opts?: { count?: "exact"; head?: boolean }): this {
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  eq(field: string, value: unknown): this {
    this.filters.push({ field, op: "eq", value });
    return this;
  }
  neq(field: string, value: unknown): this {
    this.filters.push({ field, op: "neq", value });
    return this;
  }
  ilike(field: string, pattern: string): this {
    this.filters.push({ field, op: "ilike", value: pattern });
    return this;
  }
  gte(field: string, value: unknown): this {
    this.filters.push({ field, op: "gte", value });
    return this;
  }
  lte(field: string, value: unknown): this {
    this.filters.push({ field, op: "lte", value });
    return this;
  }
  in(field: string, values: unknown[]): this {
    this.filters.push({ field, op: "in", value: values });
    return this;
  }
  not(field: string, op: string, value: unknown): this {
    this.filters.push({ field, op: `not.${op}`, value });
    return this;
  }
  or(expr: string): this {
    this.orGroups.push(parseOrExpression(expr));
    return this;
  }
  order(field: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const ascending = opts?.ascending !== false;
    // PostgreSQL/PostgRESTの既定: 明示指定が無ければDESCはnullsFirst、ASCはnullsLast
    // (SQLiteの既定「NULLは常に最小値」とは正反対)。実クライアントと同じ既定値を再現する。
    const nullsFirst = opts?.nullsFirst ?? !ascending;
    this.orderKeys.push({ field, ascending, nullsFirst });
    return this;
  }
  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  limit(n: number): this {
    this.rangeFrom = 0;
    this.rangeTo = n - 1;
    return this;
  }
  maybeSingle(): this {
    this.singleMode = "maybeSingle";
    return this;
  }
  single(): this {
    this.singleMode = "single";
    return this;
  }

  private matches(row: Row): boolean {
    for (const f of this.filters) if (!matchOne(row, f)) return false;
    for (const group of this.orGroups) if (!group.some((f) => matchOne(row, f))) return false;
    return true;
  }

  private resolve(): FakeResult {
    let rows = this.rows.filter((r) => this.matches(r));
    const count = this.wantCount ? rows.length : null;

    for (const key of [...this.orderKeys].reverse()) {
      rows = [...rows].sort((a, b) => {
        const av = a[key.field];
        const bv = b[key.field];
        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull && bNull) return 0;
        if (aNull) return key.nullsFirst ? -1 : 1;
        if (bNull) return key.nullsFirst ? 1 : -1;
        if (av === bv) return 0;
        const cmp = (av as never) > (bv as never) ? 1 : -1;
        return key.ascending ? cmp : -cmp;
      });
    }

    if (this.rangeFrom != null && this.rangeTo != null) {
      rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
    }

    if (this.singleMode === "single") {
      if (rows.length === 0) return { data: null, error: { code: "PGRST116", message: "no rows returned" }, count, status: 406 };
      return { data: rows[0], error: null, count, status: 200 };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null, count, status: 200 };
    }
    return { data: this.headOnly ? null : rows, error: null, count, status: 200 };
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

/** テーブル名 → 行配列 を渡すと、`.from(table)`だけを提供する最小限のフェイククライアントを返す。 */
export function createFakeReferenceDataClient(tables: Tables) {
  return {
    from(table: string) {
      if (!(table in tables)) {
        throw new Error(`createFakeReferenceDataClient: 未登録のテーブル "${table}"`);
      }
      return new FakeQueryBuilder(tables[table]);
    },
  };
}

/**
 * 常にエラーを返すフェイククライアント(接続失敗・RLS拒否・障害系テスト用)。
 * `status`は実PostgREST/postgrest-jsのクエリ結果`{ data, error, status }`の`status`に相当する
 * (エラーオブジェクト自体には乗らない。ネットワーク断・タイムアウトは`status: 0`、
 * それ以外はPostgRESTが返す実HTTPステータス。ライブラリソース確認済み)。省略時は`undefined`。
 */
export function createFailingReferenceDataClient(error: { code?: string; message: string }, status?: number) {
  const failingBuilder: Record<string, unknown> = {
    select: () => failingBuilder,
    eq: () => failingBuilder,
    neq: () => failingBuilder,
    ilike: () => failingBuilder,
    gte: () => failingBuilder,
    lte: () => failingBuilder,
    in: () => failingBuilder,
    not: () => failingBuilder,
    or: () => failingBuilder,
    order: () => failingBuilder,
    range: () => failingBuilder,
    limit: () => failingBuilder,
    maybeSingle: () => failingBuilder,
    single: () => failingBuilder,
    then(onfulfilled?: ((value: FakeResult) => unknown) | null) {
      return Promise.resolve({ data: null, error, count: null, status }).then(onfulfilled ?? undefined);
    },
  };
  return {
    from() {
      return failingBuilder;
    },
  };
}
