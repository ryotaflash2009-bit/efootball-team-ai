# Phase D シャドー比較結果

実行日時: 2026-09-15T15:05:40.075Z 〜 2026-09-15T15:06:53.510Z

**実Supabaseへの書込みは一切行っていない(anonキーでのSELECT/Data API読み取りのみ)。**

## 総合判定: 差分0件

## A. 件数(SQLite実測 vs Supabase実測)

- world_player_cards: SQLite=13009 / Supabase=13009 / 一致=true
- managers: SQLite=66 / Supabase=66 / 一致=true
- SQLite側の期待値: efhub実リンク=653件 / ai_styles非空=11558件 / appearance設定=13009件 / conflicts非空=21件
- SQLite側の期待値: boosters非空=64件 / link_up_plays非空=25件

## B. world_player_cards 新規4列の全件比較(13,009件、ページング)

- Supabaseから取得: 13009件(1.1秒、14リクエスト)
- 比較件数: 13009 / 差分件数: 0
- 差分カテゴリ内訳: {"efhub_card_id":0,"ai_styles":0,"appearance":0,"efhub_conflicts":0}

## C. managers 全件(66件)のAPP-LEVEL detail比較

- 比較件数: 66 / 差分件数: 0 / 内部監査情報の漏洩: 0件

## D. player_card_analysis 全件(19件)のAPP-LEVEL比較

- 比較件数: 19 / 差分件数: 0

## E. world_player_cards 詳細サンプル比較(全conflictカード21件+層化サンプル)

- 比較件数: 51(conflict全件21件含む) / 差分件数: 0 / 内部監査情報の漏洩検出: 0件

## F. 検索・フィルター・ソート・ページング(全PKセット+順序比較)

- [world:検索語なし] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- [world:英語名部分一致] totalCount sqlite=14 supabase=14 / 主キー集合差分=0 / 順序=一致
- [world:日本語名部分一致] totalCount sqlite=1 supabase=1 / 主キー集合差分=0 / 順序=一致
- [world:存在しない名前] totalCount sqlite=0 supabase=0 / 主キー集合差分=0 / 順序=一致
- [world:完全ID] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- [world:position絞り込み] totalCount sqlite=1281 supabase=1281 / 主キー集合差分=0 / 順序=一致
- [world:cardType絞り込み] totalCount sqlite=129 supabase=129 / 主キー集合差分=0 / 順序=一致
- [world:minOvr] totalCount sqlite=12092 supabase=12092 / 主キー集合差分=0 / 順序=一致
- [world:maxOvr] totalCount sqlite=1 supabase=1 / 主キー集合差分=0 / 順序=一致
- [world:複合条件(position+minOvr)] totalCount sqlite=1280 supabase=1280 / 主キー集合差分=0 / 順序=一致
- [world:0件条件] totalCount sqlite=0 supabase=0 / 主キー集合差分=0 / 順序=一致
- [world:hasBooster=true(全主キー集合)] totalCount sqlite=2314 supabase=2314 / 主キー集合差分=0 / 順序=一致
- [world:hasBooster=false(全主キー集合)] totalCount sqlite=10695 supabase=10695 / 主キー集合差分=0 / 順序=一致
- [world:sort=ovr_max_asc] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- [world:sort=ovr_base_desc] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- [world:sort=ovr_base_asc] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- [world:sort=name(collation)] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- [world:sort=updated_desc] totalCount sqlite=13009 supabase=13009 / 主キー集合差分=0 / 順序=一致
- --- ページング境界確認(pageSize=5) ---
- [paging:world:page=1] 件数一致=true 順序一致=true hasNext一致=true
- [paging:world:page=2] 件数一致=true 順序一致=true hasNext一致=true
- [paging:world:page=2602] 件数一致=true 順序一致=true hasNext一致=true
- [managers:検索語なし・sort=name] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=released_desc(NULL2件を含む)] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=released_asc(NULL2件を含む)] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=possession_desc] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=quick_counter_desc] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=long_ball_counter_desc] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=out_wide_desc] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=long_ball_desc] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:sort=overload_desc(NULL64件を含む)] totalCount sqlite=66 supabase=66 / 主キー集合差分=0 / 順序一致=true
- [managers:hasBooster=true] totalCount sqlite=64 supabase=64 / 主キー集合差分=0 / 順序一致=true
- [managers:hasBooster=false] totalCount sqlite=2 supabase=2 / 主キー集合差分=0 / 順序一致=true
- [managers:hasLinkUpPlay=true] totalCount sqlite=25 supabase=25 / 主キー集合差分=0 / 順序一致=true
- [managers:hasBooster=false + sort=overload_desc(NULL含むフィルター結果)] totalCount sqlite=2 supabase=2 / 主キー集合差分=0 / 順序一致=true
- [managers:hasLinkUpPlay=true + sort=released_asc(NULL含むフィルター結果)] totalCount sqlite=25 supabase=25 / 主キー集合差分=0 / 順序一致=true
- --- ページング境界確認(managers、pageSize=1、sort=possession_desc) ---
- [paging:managers:page=1] 順序一致=true hasNext一致=true
- [paging:managers:page=2] 順序一致=true hasNext一致=true
- [paging:managers:page=66] 順序一致=true hasNext一致=true

## G. facets / sourceMeta

- facets一致: true
- sourceMeta.totalCount: sqlite=13009 supabase=13009 一致=true
- 既知の制約: syncFinishedAt/syncStatusはworld_sync_state/world_sync_runs相当が未移行のため一致しない(sqlite=done, supabase=null)。本Phase Dの対象外(Phase C時点からの既知の制約)。
- managerCount: sqlite=66 supabase=66 一致=true

## H. 性能測定(本比較実行中の実測、SQLite vs Supabase)

- count:managers: n=1 avg=48.2ms median=48.2ms p95=48.2ms max=48.2ms
- count:world: n=1 avg=118.7ms median=118.7ms p95=118.7ms max=118.7ms
- detail:analysis:sqlite: n=19 avg=0.6ms median=0.6ms p95=1.0ms max=1.0ms
- detail:analysis:supabase: n=19 avg=72.0ms median=70.0ms p95=122.4ms max=122.4ms
- detail:manager:sqlite: n=66 avg=0.6ms median=0.5ms p95=1.0ms max=1.7ms
- detail:manager:supabase: n=66 avg=42.5ms median=43.5ms p95=55.0ms max=74.9ms
- detail:world:sqlite: n=51 avg=0.9ms median=0.8ms p95=1.3ms max=2.1ms
- detail:world:supabase: n=51 avg=39.5ms median=41.6ms p95=47.7ms max=49.6ms
- list:managers:hasBooster=false + sort=overload_desc(NULL含むフィルター結果):sqlite: n=1 avg=0.9ms median=0.9ms p95=0.9ms max=0.9ms
- list:managers:hasBooster=false + sort=overload_desc(NULL含むフィルター結果):supabase: n=1 avg=74.1ms median=74.1ms p95=74.1ms max=74.1ms
- list:managers:hasBooster=false:sqlite: n=1 avg=0.7ms median=0.7ms p95=0.7ms max=0.7ms
- list:managers:hasBooster=false:supabase: n=1 avg=77.7ms median=77.7ms p95=77.7ms max=77.7ms
- list:managers:hasBooster=true:sqlite: n=1 avg=2.8ms median=2.8ms p95=2.8ms max=2.8ms
- list:managers:hasBooster=true:supabase: n=1 avg=335.9ms median=335.9ms p95=335.9ms max=335.9ms
- list:managers:hasLinkUpPlay=true + sort=released_asc(NULL含むフィルター結果):sqlite: n=1 avg=1.8ms median=1.8ms p95=1.8ms max=1.8ms
- list:managers:hasLinkUpPlay=true + sort=released_asc(NULL含むフィルター結果):supabase: n=1 avg=148.8ms median=148.8ms p95=148.8ms max=148.8ms
- list:managers:hasLinkUpPlay=true:sqlite: n=1 avg=1.1ms median=1.1ms p95=1.1ms max=1.1ms
- list:managers:hasLinkUpPlay=true:supabase: n=1 avg=169.8ms median=169.8ms p95=169.8ms max=169.8ms
- list:managers:sort=long_ball_counter_desc:sqlite: n=1 avg=3.3ms median=3.3ms p95=3.3ms max=3.3ms
- list:managers:sort=long_ball_counter_desc:supabase: n=1 avg=430.8ms median=430.8ms p95=430.8ms max=430.8ms
- list:managers:sort=long_ball_desc:sqlite: n=1 avg=2.5ms median=2.5ms p95=2.5ms max=2.5ms
- list:managers:sort=long_ball_desc:supabase: n=1 avg=323.3ms median=323.3ms p95=323.3ms max=323.3ms
- list:managers:sort=out_wide_desc:sqlite: n=1 avg=2.4ms median=2.4ms p95=2.4ms max=2.4ms
- list:managers:sort=out_wide_desc:supabase: n=1 avg=316.1ms median=316.1ms p95=316.1ms max=316.1ms
- list:managers:sort=overload_desc(NULL64件を含む):sqlite: n=1 avg=3.6ms median=3.6ms p95=3.6ms max=3.6ms
- list:managers:sort=overload_desc(NULL64件を含む):supabase: n=1 avg=336.6ms median=336.6ms p95=336.6ms max=336.6ms
- list:managers:sort=possession_desc:sqlite: n=1 avg=2.3ms median=2.3ms p95=2.3ms max=2.3ms
- list:managers:sort=possession_desc:supabase: n=1 avg=367.9ms median=367.9ms p95=367.9ms max=367.9ms
- list:managers:sort=quick_counter_desc:sqlite: n=1 avg=2.4ms median=2.4ms p95=2.4ms max=2.4ms
- list:managers:sort=quick_counter_desc:supabase: n=1 avg=364.9ms median=364.9ms p95=364.9ms max=364.9ms
- list:managers:sort=released_asc(NULL2件を含む):sqlite: n=1 avg=1.7ms median=1.7ms p95=1.7ms max=1.7ms
- list:managers:sort=released_asc(NULL2件を含む):supabase: n=1 avg=320.2ms median=320.2ms p95=320.2ms max=320.2ms
- list:managers:sort=released_desc(NULL2件を含む):sqlite: n=1 avg=3.2ms median=3.2ms p95=3.2ms max=3.2ms
- list:managers:sort=released_desc(NULL2件を含む):supabase: n=1 avg=314.7ms median=314.7ms p95=314.7ms max=314.7ms
- list:managers:検索語なし・sort=name:sqlite: n=1 avg=2.5ms median=2.5ms p95=2.5ms max=2.5ms
- list:managers:検索語なし・sort=name:supabase: n=1 avg=345.9ms median=345.9ms p95=345.9ms max=345.9ms
- list:world:0件条件:sqlite: n=1 avg=49.2ms median=49.2ms p95=49.2ms max=49.2ms
- list:world:0件条件:supabase: n=1 avg=211.2ms median=211.2ms p95=211.2ms max=211.2ms
- list:world:cardType絞り込み:sqlite: n=1 avg=1.7ms median=1.7ms p95=1.7ms max=1.7ms
- list:world:cardType絞り込み:supabase: n=1 avg=103.5ms median=103.5ms p95=103.5ms max=103.5ms
- list:world:hasBooster=false(全主キー集合):sqlite: n=1 avg=1093.5ms median=1093.5ms p95=1093.5ms max=1093.5ms
- list:world:hasBooster=false(全主キー集合):supabase: n=1 avg=4169.0ms median=4169.0ms p95=4169.0ms max=4169.0ms
- list:world:hasBooster=true(全主キー集合):sqlite: n=1 avg=128.1ms median=128.1ms p95=128.1ms max=128.1ms
- list:world:hasBooster=true(全主キー集合):supabase: n=1 avg=876.3ms median=876.3ms p95=876.3ms max=876.3ms
- list:world:maxOvr:sqlite: n=1 avg=0.6ms median=0.6ms p95=0.6ms max=0.6ms
- list:world:maxOvr:supabase: n=1 avg=82.5ms median=82.5ms p95=82.5ms max=82.5ms
- list:world:minOvr:sqlite: n=1 avg=1769.0ms median=1769.0ms p95=1769.0ms max=1769.0ms
- list:world:minOvr:supabase: n=1 avg=4554.0ms median=4554.0ms p95=4554.0ms max=4554.0ms
- list:world:position絞り込み:sqlite: n=1 avg=35.8ms median=35.8ms p95=35.8ms max=35.8ms
- list:world:position絞り込み:supabase: n=1 avg=473.9ms median=473.9ms p95=473.9ms max=473.9ms
- list:world:sort=name(collation):sqlite: n=1 avg=1697.9ms median=1697.9ms p95=1697.9ms max=1697.9ms
- list:world:sort=name(collation):supabase: n=1 avg=4440.1ms median=4440.1ms p95=4440.1ms max=4440.1ms
- list:world:sort=ovr_base_asc:sqlite: n=1 avg=1074.2ms median=1074.2ms p95=1074.2ms max=1074.2ms
- list:world:sort=ovr_base_asc:supabase: n=1 avg=5912.1ms median=5912.1ms p95=5912.1ms max=5912.1ms
- list:world:sort=ovr_base_desc:sqlite: n=1 avg=1021.4ms median=1021.4ms p95=1021.4ms max=1021.4ms
- list:world:sort=ovr_base_desc:supabase: n=1 avg=5986.2ms median=5986.2ms p95=5986.2ms max=5986.2ms
- list:world:sort=ovr_max_asc:sqlite: n=1 avg=1294.0ms median=1294.0ms p95=1294.0ms max=1294.0ms
- list:world:sort=ovr_max_asc:supabase: n=1 avg=4909.2ms median=4909.2ms p95=4909.2ms max=4909.2ms
- list:world:sort=updated_desc:sqlite: n=1 avg=880.8ms median=880.8ms p95=880.8ms max=880.8ms
- list:world:sort=updated_desc:supabase: n=1 avg=5463.5ms median=5463.5ms p95=5463.5ms max=5463.5ms
- list:world:存在しない名前:sqlite: n=1 avg=36.2ms median=36.2ms p95=36.2ms max=36.2ms
- list:world:存在しない名前:supabase: n=1 avg=230.9ms median=230.9ms p95=230.9ms max=230.9ms
- list:world:完全ID:sqlite: n=1 avg=924.7ms median=924.7ms p95=924.7ms max=924.7ms
- list:world:完全ID:supabase: n=1 avg=4978.9ms median=4978.9ms p95=4978.9ms max=4978.9ms
- list:world:日本語名部分一致:sqlite: n=1 avg=37.5ms median=37.5ms p95=37.5ms max=37.5ms
- list:world:日本語名部分一致:supabase: n=1 avg=219.3ms median=219.3ms p95=219.3ms max=219.3ms
- list:world:検索語なし:sqlite: n=1 avg=1170.4ms median=1170.4ms p95=1170.4ms max=1170.4ms
- list:world:検索語なし:supabase: n=1 avg=4983.3ms median=4983.3ms p95=4983.3ms max=4983.3ms
- list:world:英語名部分一致:sqlite: n=1 avg=40.7ms median=40.7ms p95=40.7ms max=40.7ms
- list:world:英語名部分一致:supabase: n=1 avg=836.4ms median=836.4ms p95=836.4ms max=836.4ms
- list:world:複合条件(position+minOvr):sqlite: n=1 avg=41.3ms median=41.3ms p95=41.3ms max=41.3ms
- list:world:複合条件(position+minOvr):supabase: n=1 avg=433.7ms median=433.7ms p95=433.7ms max=433.7ms
- list:world_columns_full: n=1 avg=1126.0ms median=1126.0ms p95=1126.0ms max=1126.0ms
- page:managers:sqlite: n=3 avg=0.7ms median=0.6ms p95=1.0ms max=1.0ms
- page:managers:supabase: n=3 avg=84.6ms median=81.3ms p95=91.9ms max=91.9ms
- page:world:sqlite: n=3 avg=18.0ms median=3.3ms p95=47.3ms max=47.3ms
- page:world:supabase: n=3 avg=107.9ms median=89.5ms p95=146.9ms max=146.9ms
