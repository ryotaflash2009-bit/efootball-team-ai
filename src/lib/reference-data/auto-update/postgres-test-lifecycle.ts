/**
 * `*.postgres.test.ts`(GitHub Actions PostgreSQL service container専用)の
 * setup/teardown安全化のための共有ヘルパー(純関数、実DB接続なし)。
 *
 * 背景(2026-09-20、PR #23マージ後のmain CIで実際に発生): 複数の`*.postgres.test.ts`
 * ファイルが同一の固定schema名(`reference_data_ops_test`等)を共有しており、Vitestの
 * 既定(ファイル単位の並列実行)のままでは、複数ファイルの`beforeAll`が同時に
 * `CREATE SCHEMA IF NOT EXISTS`を実行し、PostgreSQL側の存在確認とCREATEが同時実行下では
 * 原子的でないことに起因する競合(`pg_namespace_nspname_index`のunique constraint違反、
 * PostgreSQLエラーコード23505)が発生した。その後、`beforeAll`が途中失敗したにもかかわらず
 * `afterAll`が無条件に(まだ作成されていない)schemaをtruncateしようとし、二次エラー
 * (`schema does not exist`、エラーコード3F000)が本来のsetupエラーを覆い隠した。
 *
 * この関数は「対応するsetup手順が成功した場合だけ、対応するcleanup手順を実行する」という
 * ガードを一箇所に集約し、`vitest.postgres.config.ts`の`fileParallelism: false`
 * (直列実行化、根本原因そのものの解消)と合わせた多層防御として使う。
 */

export interface GuardedCleanupStep {
  /** このステップに対応するsetupが成功したか。falseならrunを一切呼び出さない。 */
  ready: boolean;
  run: () => Promise<void>;
}

/** readyがtrueのステップだけを、宣言順に直列実行する。 */
export async function runGuardedCleanup(steps: readonly GuardedCleanupStep[]): Promise<void> {
  for (const step of steps) {
    if (step.ready) {
      await step.run();
    }
  }
}
