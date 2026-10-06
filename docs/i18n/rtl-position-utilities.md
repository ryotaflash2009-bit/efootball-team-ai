# 物理的な左右の位置の分類（RTL の準備）

`node scripts/i18n-rtl-position-audit.mjs` が生成する（手で編集しない）。RTL の言語（ar など）は公開しない方針のため、置き換えは RTL を公開するときに行う。
余白・文字揃え・枠線・角丸は 2026-10-06 に論理プロパティへ置き換え済み（architecture.md §9）。ここに残るのは位置の指定だけ。

| 分類 | class（Tailwind） | inline style |
|---|---:|---:|
| そのまま（ピッチの座標・中央寄せ・左右対称の帯。鏡像にしない） | 26 | 7 |
| 論理プロパティへ（start-/end-。RTL を公開する前に置き換える。LTR の見た目は変わらない） | 0 | 0 |
| 要決定（スライダーの値の向き。RTL で反転するかを決めてから） | 1 | 4 |
| 装飾（どちらでもよい） | 1 | 0 |
| **合計** | **28** | **11** |

## そのまま（ピッチの座標・中央寄せ・左右対称の帯。鏡像にしない）

| 場所 | 指定 |
|---|---|
| `./src/components/best-xi/BestXiView.tsx:313` | `-translate-x-1/2` |
| `./src/components/best-xi/BestXiView.tsx:314` | `style left` |
| `./src/components/squad/CompareMiniPitch.tsx:55` | `left-2` |
| `./src/components/squad/CompareMiniPitch.tsx:55` | `right-2` |
| `./src/components/squad/CompareMiniPitch.tsx:63` | `style left` |
| `./src/components/squad/CompareMiniPitch.tsx:64` | `-translate-x-1/2` |
| `./src/components/squad/MiniPitch.tsx:21` | `left-2` |
| `./src/components/squad/MiniPitch.tsx:21` | `right-2` |
| `./src/components/squad/MiniPitch.tsx:25` | `style left` |
| `./src/components/squad/MiniPitch.tsx:26` | `-translate-x-1/2` |
| `./src/components/squad/SquadPitch.tsx:179` | `left-3` |
| `./src/components/squad/SquadPitch.tsx:179` | `right-3` |
| `./src/components/squad/SquadPitch.tsx:180` | `left-1/2` |
| `./src/components/squad/SquadPitch.tsx:180` | `-translate-x-1/2` |
| `./src/components/squad/SquadPitch.tsx:181` | `left-1/2` |
| `./src/components/squad/SquadPitch.tsx:181` | `-translate-x-1/2` |
| `./src/components/squad/SquadPitch.tsx:182` | `left-1/2` |
| `./src/components/squad/SquadPitch.tsx:182` | `-translate-x-1/2` |
| `./src/components/squad/SquadPitch.tsx:188` | `style left` |
| `./src/components/squad/SquadPitch.tsx:191` | `left-0` |
| `./src/components/squad/SquadPitch.tsx:191` | `right-0` |
| `./src/components/squad/SquadPitch.tsx:197` | `left-1/2` |
| `./src/components/squad/SquadPitch.tsx:205` | `left-0` |
| `./src/components/squad/SquadPitch.tsx:205` | `right-0` |
| `./src/components/squad/SquadPitch.tsx:207` | `style left` |
| `./src/components/squad/SquadPitch.tsx:211` | `left-1` |
| `./src/components/squad/SquadPitch.tsx:211` | `left-1` |
| `./src/components/squad/SquadPitch.tsx:223` | `-translate-x-1/2` |
| `./src/components/squad/SquadPitch.tsx:224` | `style left` |
| `./src/components/squad/SquadPitch.tsx:308` | `style left` |
| `./src/components/squad/SquadPitch.tsx:309` | `-translate-x-1/2` |
| `./src/components/ui/Tooltip.tsx:33` | `left-1/2` |
| `./src/components/ui/Tooltip.tsx:33` | `-translate-x-1/2` |

## 要決定（スライダーの値の向き。RTL で反転するかを決めてから）

| 場所 | 指定 |
|---|---|
| `./src/components/world/progression/ability-editor/CategorySlider.tsx:125` | `style left` |
| `./src/components/world/progression/ability-editor/CategorySlider.tsx:125` | `style right` |
| `./src/components/world/progression/ability-editor/CategorySlider.tsx:129` | `left-0` |
| `./src/components/world/progression/ability-editor/CategorySlider.tsx:133` | `style left` |
| `./src/components/world/progression/ability-editor/CategorySlider.tsx:140` | `style left` |

## 装飾（どちらでもよい）

| 場所 | 指定 |
|---|---|
| `./src/components/HomePageView.tsx:153` | `-right-16` |

## 注意

- `TO_LOGICAL` のうち、角丸がすでに論理（`rounded-ee` など）で位置が物理（`left-0`）の組み合わせは、RTL で角丸だけが反転してずれる。置き換えるときは位置と角丸をそろえる。
- ピッチ（スカッド・ベスト11）の x 座標はゲームのポジション（左サイド・右サイド）を表すため、RTL でも鏡像にしない。
