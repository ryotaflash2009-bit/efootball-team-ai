# Phase D シャドー比較結果

実行日時: 2026-09-18T10:42:49.047Z 〜 2026-09-18T10:43:57.762Z

**実Supabaseへの書込みは一切行っていない(anonキーでのSELECT/Data API読み取りのみ)。**

## 総合判定: 差分0件

## A. 件数(SQLite実測 vs Supabase実測)

- world_player_cards: SQLite=13009 / Supabase=13009 / 一致=true
- managers: SQLite=66 / Supabase=66 / 一致=true
- SQLite側の期待値: efhub実リンク=653件 / ai_styles非空=11558件 / appearance設定=13009件 / conflicts非空=21件
- SQLite側の期待値: boosters非空=64件 / link_up_plays非空=25件

## B. world_player_cards 新規4列の全件比較(13,009件、ページング)

- Supabaseから取得: 13009件(1.2秒、14リクエスト)
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

- count:managers: n=1 avg=59.1ms median=59.1ms p95=59.1ms max=59.1ms
- count:world: n=1 avg=89.3ms median=89.3ms p95=89.3ms max=89.3ms
- detail:analysis:sqlite: n=19 avg=0.4ms median=0.4ms p95=0.5ms max=0.5ms
- detail:analysis:supabase: n=19 avg=75.8ms median=76.1ms p95=82.9ms max=82.9ms
- detail:manager:sqlite: n=66 avg=0.4ms median=0.4ms p95=0.5ms max=1.3ms
- detail:manager:supabase: n=66 avg=31.1ms median=30.5ms p95=39.0ms max=40.8ms
- detail:world:sqlite: n=51 avg=0.6ms median=0.6ms p95=0.7ms max=1.2ms
- detail:world:supabase: n=51 avg=31.8ms median=30.7ms p95=40.0ms max=48.1ms
- list:managers:hasBooster=false + sort=overload_desc(NULL含むフィルター結果):sqlite: n=1 avg=0.5ms median=0.5ms p95=0.5ms max=0.5ms
- list:managers:hasBooster=false + sort=overload_desc(NULL含むフィルター結果):supabase: n=1 avg=95.0ms median=95.0ms p95=95.0ms max=95.0ms
- list:managers:hasBooster=false:sqlite: n=1 avg=0.5ms median=0.5ms p95=0.5ms max=0.5ms
- list:managers:hasBooster=false:supabase: n=1 avg=96.0ms median=96.0ms p95=96.0ms max=96.0ms
- list:managers:hasBooster=true:sqlite: n=1 avg=1.4ms median=1.4ms p95=1.4ms max=1.4ms
- list:managers:hasBooster=true:supabase: n=1 avg=395.2ms median=395.2ms p95=395.2ms max=395.2ms
- list:managers:hasLinkUpPlay=true + sort=released_asc(NULL含むフィルター結果):sqlite: n=1 avg=0.8ms median=0.8ms p95=0.8ms max=0.8ms
- list:managers:hasLinkUpPlay=true + sort=released_asc(NULL含むフィルター結果):supabase: n=1 avg=178.9ms median=178.9ms p95=178.9ms max=178.9ms
- list:managers:hasLinkUpPlay=true:sqlite: n=1 avg=0.8ms median=0.8ms p95=0.8ms max=0.8ms
- list:managers:hasLinkUpPlay=true:supabase: n=1 avg=219.2ms median=219.2ms p95=219.2ms max=219.2ms
- list:managers:sort=long_ball_counter_desc:sqlite: n=1 avg=1.7ms median=1.7ms p95=1.7ms max=1.7ms
- list:managers:sort=long_ball_counter_desc:supabase: n=1 avg=351.7ms median=351.7ms p95=351.7ms max=351.7ms
- list:managers:sort=long_ball_desc:sqlite: n=1 avg=1.6ms median=1.6ms p95=1.6ms max=1.6ms
- list:managers:sort=long_ball_desc:supabase: n=1 avg=380.4ms median=380.4ms p95=380.4ms max=380.4ms
- list:managers:sort=out_wide_desc:sqlite: n=1 avg=1.5ms median=1.5ms p95=1.5ms max=1.5ms
- list:managers:sort=out_wide_desc:supabase: n=1 avg=351.4ms median=351.4ms p95=351.4ms max=351.4ms
- list:managers:sort=overload_desc(NULL64件を含む):sqlite: n=1 avg=1.5ms median=1.5ms p95=1.5ms max=1.5ms
- list:managers:sort=overload_desc(NULL64件を含む):supabase: n=1 avg=357.9ms median=357.9ms p95=357.9ms max=357.9ms
- list:managers:sort=possession_desc:sqlite: n=1 avg=1.5ms median=1.5ms p95=1.5ms max=1.5ms
- list:managers:sort=possession_desc:supabase: n=1 avg=396.9ms median=396.9ms p95=396.9ms max=396.9ms
- list:managers:sort=quick_counter_desc:sqlite: n=1 avg=1.4ms median=1.4ms p95=1.4ms max=1.4ms
- list:managers:sort=quick_counter_desc:supabase: n=1 avg=328.4ms median=328.4ms p95=328.4ms max=328.4ms
- list:managers:sort=released_asc(NULL2件を含む):sqlite: n=1 avg=1.4ms median=1.4ms p95=1.4ms max=1.4ms
- list:managers:sort=released_asc(NULL2件を含む):supabase: n=1 avg=343.7ms median=343.7ms p95=343.7ms max=343.7ms
- list:managers:sort=released_desc(NULL2件を含む):sqlite: n=1 avg=1.6ms median=1.6ms p95=1.6ms max=1.6ms
- list:managers:sort=released_desc(NULL2件を含む):supabase: n=1 avg=396.8ms median=396.8ms p95=396.8ms max=396.8ms
- list:managers:検索語なし・sort=name:sqlite: n=1 avg=1.8ms median=1.8ms p95=1.8ms max=1.8ms
- list:managers:検索語なし・sort=name:supabase: n=1 avg=378.5ms median=378.5ms p95=378.5ms max=378.5ms
- list:world:0件条件:sqlite: n=1 avg=30.2ms median=30.2ms p95=30.2ms max=30.2ms
- list:world:0件条件:supabase: n=1 avg=222.5ms median=222.5ms p95=222.5ms max=222.5ms
- list:world:cardType絞り込み:sqlite: n=1 avg=1.5ms median=1.5ms p95=1.5ms max=1.5ms
- list:world:cardType絞り込み:supabase: n=1 avg=109.3ms median=109.3ms p95=109.3ms max=109.3ms
- list:world:hasBooster=false(全主キー集合):sqlite: n=1 avg=575.7ms median=575.7ms p95=575.7ms max=575.7ms
- list:world:hasBooster=false(全主キー集合):supabase: n=1 avg=4147.8ms median=4147.8ms p95=4147.8ms max=4147.8ms
- list:world:hasBooster=true(全主キー集合):sqlite: n=1 avg=71.4ms median=71.4ms p95=71.4ms max=71.4ms
- list:world:hasBooster=true(全主キー集合):supabase: n=1 avg=823.8ms median=823.8ms p95=823.8ms max=823.8ms
- list:world:maxOvr:sqlite: n=1 avg=0.5ms median=0.5ms p95=0.5ms max=0.5ms
- list:world:maxOvr:supabase: n=1 avg=95.7ms median=95.7ms p95=95.7ms max=95.7ms
- list:world:minOvr:sqlite: n=1 avg=902.8ms median=902.8ms p95=902.8ms max=902.8ms
- list:world:minOvr:supabase: n=1 avg=4505.6ms median=4505.6ms p95=4505.6ms max=4505.6ms
- list:world:position絞り込み:sqlite: n=1 avg=25.3ms median=25.3ms p95=25.3ms max=25.3ms
- list:world:position絞り込み:supabase: n=1 avg=419.7ms median=419.7ms p95=419.7ms max=419.7ms
- list:world:sort=name(collation):sqlite: n=1 avg=769.1ms median=769.1ms p95=769.1ms max=769.1ms
- list:world:sort=name(collation):supabase: n=1 avg=4583.8ms median=4583.8ms p95=4583.8ms max=4583.8ms
- list:world:sort=ovr_base_asc:sqlite: n=1 avg=630.7ms median=630.7ms p95=630.7ms max=630.7ms
- list:world:sort=ovr_base_asc:supabase: n=1 avg=6615.6ms median=6615.6ms p95=6615.6ms max=6615.6ms
- list:world:sort=ovr_base_desc:sqlite: n=1 avg=579.2ms median=579.2ms p95=579.2ms max=579.2ms
- list:world:sort=ovr_base_desc:supabase: n=1 avg=7272.3ms median=7272.3ms p95=7272.3ms max=7272.3ms
- list:world:sort=ovr_max_asc:sqlite: n=1 avg=658.6ms median=658.6ms p95=658.6ms max=658.6ms
- list:world:sort=ovr_max_asc:supabase: n=1 avg=4738.1ms median=4738.1ms p95=4738.1ms max=4738.1ms
- list:world:sort=updated_desc:sqlite: n=1 avg=464.4ms median=464.4ms p95=464.4ms max=464.4ms
- list:world:sort=updated_desc:supabase: n=1 avg=5700.6ms median=5700.6ms p95=5700.6ms max=5700.6ms
- list:world:存在しない名前:sqlite: n=1 avg=32.6ms median=32.6ms p95=32.6ms max=32.6ms
- list:world:存在しない名前:supabase: n=1 avg=215.0ms median=215.0ms p95=215.0ms max=215.0ms
- list:world:完全ID:sqlite: n=1 avg=656.5ms median=656.5ms p95=656.5ms max=656.5ms
- list:world:完全ID:supabase: n=1 avg=4786.4ms median=4786.4ms p95=4786.4ms max=4786.4ms
- list:world:日本語名部分一致:sqlite: n=1 avg=29.8ms median=29.8ms p95=29.8ms max=29.8ms
- list:world:日本語名部分一致:supabase: n=1 avg=213.7ms median=213.7ms p95=213.7ms max=213.7ms
- list:world:検索語なし:sqlite: n=1 avg=654.9ms median=654.9ms p95=654.9ms max=654.9ms
- list:world:検索語なし:supabase: n=1 avg=4966.9ms median=4966.9ms p95=4966.9ms max=4966.9ms
- list:world:英語名部分一致:sqlite: n=1 avg=32.4ms median=32.4ms p95=32.4ms max=32.4ms
- list:world:英語名部分一致:supabase: n=1 avg=227.9ms median=227.9ms p95=227.9ms max=227.9ms
- list:world:複合条件(position+minOvr):sqlite: n=1 avg=24.9ms median=24.9ms p95=24.9ms max=24.9ms
- list:world:複合条件(position+minOvr):supabase: n=1 avg=445.1ms median=445.1ms p95=445.1ms max=445.1ms
- list:world_columns_full: n=1 avg=1228.1ms median=1228.1ms p95=1228.1ms max=1228.1ms
- page:managers:sqlite: n=3 avg=0.4ms median=0.5ms p95=0.5ms max=0.5ms
- page:managers:supabase: n=3 avg=95.0ms median=90.2ms p95=105.9ms max=105.9ms
- page:world:sqlite: n=3 avg=13.1ms median=2.6ms p95=34.1ms max=34.1ms
- page:world:supabase: n=3 avg=113.0ms median=101.3ms p95=151.4ms max=151.4ms
