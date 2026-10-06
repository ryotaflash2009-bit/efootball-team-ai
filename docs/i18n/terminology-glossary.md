# TeamAIXI 用語集（Terminology glossary）— glossary-2026-10-06

翻訳の一貫性のための用語集。**日本語・英語は v1.0 の画面の実際の表記（正）。ほかの言語はすべて AI の下書き
（`MACHINE_DRAFT`）で、人のレビュー・ネイティブの確認は済んでいない。** ゲーム内の公式の表記（各言語版の eFootball™）
と照合できた用語は「Source」に記録し、照合するまで `draft` のままにする。

規則:
- 同じ英単語でも画面の文脈で意味が違うものはキーを分ける（例: 保存は 4 つ）。
- 選手名・監督名・カード名・プレースタイル名は翻訳しない（`architecture.md` §5 の優先の順）。
- 「辛口評価」は、攻撃的・侮辱的にしない（各言語で「率直な・辛口の」程度）。
- 表記の揺れを防ぐため、辞書の翻訳はこの表の語を使う。表に無い重要な語は、追加してから翻訳する。

状態: `approved`（本人・レビュー担当が承認）/ `source`（v1.0 の画面の表記）/ `draft`（AI の下書き）。

## 1. 能力・育成

| Key | ja | en | es | pt-BR | fr | de | it | ko | zh-CN | zh-TW | id | tr | Context / Notes | State |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| term.ability | 能力値 | Ability / stat | Atributo | Atributo | Statistique | Attribut | Statistica | 능력치 | 能力值 | 能力值 | Atribut | Özellik | 26 の能力の 1 つ。「スキル」と混同しない | ja/en source, others draft |
| term.progression | 育成 | Progression | Progresión | Progressão | Progression | Entwicklung | Progressione | 육성 | 培养 | 培養 | Progresi | Gelişim | 能力にポイントを割り振る機能。「トレーニング」と訳さない | ja/en source, others draft |
| term.progressionPoint | 育成ポイント | Progression points | Puntos de progresión | Pontos de progressão | Points de progression | Entwicklungspunkte | Punti progressione | 육성 포인트 | 培养点数 | 培養點數 | Poin progresi | Gelişim puanı | 複数形で使うことが多い | ja/en source, others draft |
| term.remainingPoints | 残り | Remaining | Restantes | Restantes | Restants | Verbleibend | Rimanenti | 남은 포인트 | 剩余 | 剩餘 | Tersisa | Kalan | 「残り 62 / 62 pt」。数は Intl・複数形の規則で | ja/en source, others draft |
| term.allocation | 配分 | Allocation | Asignación | Distribuição | Répartition | Verteilung | Distribuzione | 배분 | 分配 | 分配 | Alokasi | Dağılım | 育成ポイントの配分 | ja/en source, others draft |
| term.rating | 評価 | Rating | Valoración | Avaliação | Note | Wertung | Valutazione | 평가치 | 评分 | 評分 | Rating | Değerlendirme | カードの評価（card_rating） | ja/en source, others draft |
| term.overallRating | 総合値（OVR） | Overall rating (OVR) | Valoración general (MED) | Geral (GER) | Note générale (GEN) | Gesamtwertung (GES) | Valutazione complessiva (CMP) | 종합 능력치 (OVR) | 综合能力值 (OVR) | 綜合能力值 (OVR) | Rating keseluruhan (OVR) | Genel derece (OVR) | 略語はゲーム内の各言語の表記を確認するまで OVR を併記 | ja/en source, others draft |
| term.maxLevel | 最大レベル | Max level | Nivel máximo | Nível máximo | Niveau max. | Max. Stufe | Livello massimo | 최대 레벨 | 最高等级 | 最高等級 | Level maksimum | Maksimum seviye | | ja/en source, others draft |
| term.baseValue | 基礎値 | Base value | Valor base | Valor base | Valeur de base | Grundwert | Valore base | 기본값 | 基础值 | 基礎值 | Nilai dasar | Temel değer | 育成前の値 | ja/en source, others draft |
| term.finalValue | 最終値 | Final value | Valor final | Valor final | Valeur finale | Endwert | Valore finale | 최종값 | 最终值 | 最終值 | Nilai akhir | Son değer | 育成・ブースター後の値 | ja/en source, others draft |
| term.booster | ブースター | Booster | Potenciador | Booster | Booster | Booster | Booster | 부스터 | 加成 | 加成 | Booster | Güçlendirici | ゲーム内の名称の確認が必要（es・tr・zh は特に） | ja/en source, others draft |
| term.percentile | パーセンタイル | Percentile | Percentil | Percentil | Percentile | Perzentil | Percentile | 백분위 | 百分位 | 百分位 | Persentil | Yüzdelik dilim | | ja/en source, others draft |
| term.topPercent | 上位 {value}% | Top {value}% | Top {value} % | Top {value}% | Top {value} % | Top {value} % | Top {value}% | 상위 {value}% | 前 {value}% | 前 {value}% | {value}% teratas | İlk %{value} | % の前後の空白・記号の位置は Intl.NumberFormat（style: percent）で決める | ja/en source, others draft |

## 2. 能力のカテゴリー

| Key | ja | en | es | pt-BR | fr | de | it | ko | zh-CN | zh-TW | id | tr | Context / Notes | State |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| term.attack | 攻撃 | Attack | Ataque | Ataque | Attaque | Angriff | Attacco | 공격 | 进攻 | 進攻 | Serangan | Hücum | カテゴリー名 | ja/en source, others draft |
| term.defense | 守備 | Defense | Defensa | Defesa | Défense | Abwehr | Difesa | 수비 | 防守 | 防守 | Pertahanan | Savunma | | ja/en source, others draft |
| term.aerial | 空中戦 | Aerial ability | Juego aéreo | Jogo aéreo | Jeu aérien | Kopfballstärke | Gioco aereo | 공중전 | 空中争顶 | 空中爭頂 | Duel udara | Hava hakimiyeti | | ja/en source, others draft |
| term.speed | スピード | Speed | Velocidad | Velocidade | Vitesse | Tempo | Velocità | 스피드 | 速度 | 速度 | Kecepatan | Hız | | ja/en source, others draft |
| term.possession | ボール保持 | Ball possession | Posesión | Posse de bola | Possession | Ballbesitz | Possesso palla | 볼 소유 | 控球 | 控球 | Penguasaan bola | Top hakimiyeti | 戦術の「ポゼッション」と区別するときは文脈で | ja/en source, others draft |
| term.passing | パス | Passing | Pase | Passe | Passes | Passspiel | Passaggio | 패스 | 传球 | 傳球 | Umpan | Pas | | ja/en source, others draft |
| term.dribbling | ドリブル | Dribbling | Regate | Drible | Dribble | Dribbling | Dribbling | 드리블 | 盘带 | 盤帶 | Dribel | Top sürme | | ja/en source, others draft |
| term.physicality | フィジカル | Physicality | Físico | Físico | Physique | Physis | Fisico | 피지컬 | 身体 | 身體 | Fisik | Fizik | | ja/en source, others draft |
| term.balance | バランス | Balance | Equilibrio | Equilíbrio | Équilibre | Balance | Equilibrio | 밸런스 | 平衡 | 平衡 | Keseimbangan | Denge | 能力の「Balance」と、スカッドの「バランスが良い」を分ける | ja/en source, others draft |
| term.finishing | 決定力 | Finishing | Definición | Finalização | Finition | Abschluss | Finalizzazione | 결정력 | 射门 | 射門 | Penyelesaian | Bitiricilik | | ja/en source, others draft |
| term.goalkeeping | GK | Goalkeeping | Portería | Goleiro | Gardien | Torwart | Portiere | 골키퍼 능력 | 守门 | 守門 | Penjaga gawang | Kalecilik | | ja/en source, others draft |

## 3. スカッド・監督

| Key | ja | en | es | pt-BR | fr | de | it | ko | zh-CN | zh-TW | id | tr | Context / Notes | State |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| term.position | ポジション | Position | Posición | Posição | Poste | Position | Ruolo | 포지션 | 位置 | 位置 | Posisi | Mevki | ポジションの略号（CF・AMF 等）はゲーム内の表記を各言語で確認するまで英語の略号 | ja/en source, others draft |
| term.positionSuitability | ポジション適性 | Position suitability | Idoneidad de posición | Aptidão de posição | Aptitude au poste | Positionseignung | Idoneità al ruolo | 포지션 적성 | 位置适应性 | 位置適性 | Kecocokan posisi | Mevki uygunluğu | | ja/en source, others draft |
| term.formation | フォーメーション | Formation | Formación | Formação | Formation | Formation | Modulo | 포메이션 | 阵型 | 陣型 | Formasi | Diziliş | it は「modulo」（サッカーの一般的な語） | ja/en source, others draft |
| term.squad | スカッド | Squad | Plantilla | Elenco | Effectif | Kader | Rosa | 스쿼드 | 阵容 | 陣容 | Skuad | Kadro | | ja/en source, others draft |
| term.startingEleven | 先発 | Starting XI | Once inicial | Time titular | Onze de départ | Startelf | Undici titolare | 선발 11인 | 首发阵容 | 先發陣容 | Starting XI | İlk 11 | | ja/en source, others draft |
| term.bench | ベンチ | Bench | Banquillo | Banco | Banc | Bank | Panchina | 벤치 | 替补席 | 板凳 | Cadangan | Yedek kulübesi | | ja/en source, others draft |
| term.substitute | 控え | Substitute | Suplente | Reserva | Remplaçant | Ersatzspieler | Riserva | 교체 선수 | 替补 | 替補 | Pemain pengganti | Yedek | | ja/en source, others draft |
| term.manager | 監督 | Manager | Entrenador | Técnico | Entraîneur | Trainer | Allenatore | 감독 | 主教练 | 總教練 | Manajer | Teknik direktör | ゲーム内の表記を確認（de「Trainer」・es「Entrenador」が一般的） | ja/en source, others draft |
| term.playstyle | プレースタイル | Playstyle | Estilo de juego | Estilo de jogo | Style de jeu | Spielstil | Stile di gioco | 플레이 스타일 | 球员风格 | 球員風格 | Gaya bermain | Oyun tarzı | プレースタイルの**名前**（Goal Poacher 等）は翻訳しない | ja/en source, others draft |
| term.linkUpPlay | Link-Up Play | Link-Up Play | Juego combinado | Jogada combinada | Jeu combiné | Kombinationsspiel | Gioco combinato | 연계 플레이 | 联动配合 | 聯動配合 | Link-Up Play | Kombinasyon oyunu | ゲーム内の機能名。各言語版の表記の確認が必要 | ja/en source, others draft |

## 4. 診断・比較

| Key | ja | en | es | pt-BR | fr | de | it | ko | zh-CN | zh-TW | id | tr | Context / Notes | State |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| term.diagnosis | 診断 | Diagnosis | Diagnóstico | Diagnóstico | Diagnostic | Analyse | Diagnosi | 진단 | 诊断 | 診斷 | Diagnosis | Analiz | de・tr は医療の語感を避けて「Analyse / Analiz」 | ja/en source, others draft |
| term.weakness | 弱点 | Weakness | Punto débil | Ponto fraco | Point faible | Schwachstelle | Punto debole | 약점 | 弱点 | 弱點 | Kelemahan | Zayıf yön | | ja/en source, others draft |
| term.improvement | 改善 | Improvement | Mejora | Melhoria | Amélioration | Verbesserung | Miglioramento | 개선 | 改进 | 改進 | Perbaikan | İyileştirme | | ja/en source, others draft |
| term.harshComment | 辛口評価 | Blunt comment | Comentario directo | Comentário direto | Commentaire franc | Klartext | Commento schietto | 직설적인 코멘트 | 直言点评 | 直言點評 | Komentar blak-blakan | Açık sözlü yorum | 侮辱・嘲笑にしない | ja/en source, others draft |
| term.compare | 比較 | Compare | Comparar | Comparar | Comparer | Vergleichen | Confronta | 비교 | 对比 | 比較 | Bandingkan | Karşılaştır | ボタン（動詞）。見出しは名詞（Comparison） | ja/en source, others draft |
| term.build | ビルド | Build | Build | Build | Build | Build | Build | 빌드 | 方案 | 方案 | Build | Build | 育成の割り振りの保存。多くの言語でゲーム用語の「build」をそのまま使う | ja/en source, others draft |

## 5. 保存・データ（文脈ごとにキーを分ける）

| Key | ja | en | es | pt-BR | fr | de | it | ko | zh-CN | zh-TW | id | tr | Context / Notes | State |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| term.saveSquad | スカッドを保存 | Save squad | Guardar plantilla | Salvar elenco | Enregistrer l’effectif | Kader speichern | Salva rosa | 스쿼드 저장 | 保存阵容 | 儲存陣容 | Simpan skuad | Kadroyu kaydet | ボタン | ja/en source, others draft |
| term.saveImage | 画像を保存 | Save image | Guardar imagen | Salvar imagem | Enregistrer l’image | Bild speichern | Salva immagine | 이미지 저장 | 保存图片 | 儲存圖片 | Simpan gambar | Görseli kaydet | 共有カード | ja/en source, others draft |
| term.saveData | データを保存 | Save data | Guardar datos | Salvar dados | Enregistrer les données | Daten speichern | Salva dati | 데이터 저장 | 保存数据 | 儲存資料 | Simpan data | Verileri kaydet | | ja/en source, others draft |
| term.savedBuilds | 保存ビルド | Saved builds | Builds guardadas | Builds salvas | Builds enregistrées | Gespeicherte Builds | Build salvate | 저장된 빌드 | 已保存的方案 | 已儲存的方案 | Build tersimpan | Kayıtlı buildler | 一覧の見出し（名詞） | ja/en source, others draft |
| term.share | 共有 | Share | Compartir | Compartilhar | Partager | Teilen | Condividi | 공유 | 分享 | 分享 | Bagikan | Paylaş | | ja/en source, others draft |
| term.export | 書き出し | Export | Exportar | Exportar | Exporter | Exportieren | Esporta | 내보내기 | 导出 | 匯出 | Ekspor | Dışa aktar | | ja/en source, others draft |
| term.import | 読み込み | Import | Importar | Importar | Importer | Importieren | Importa | 가져오기 | 导入 | 匯入 | Impor | İçe aktar | | ja/en source, others draft |
| term.backup | バックアップ | Backup | Copia de seguridad | Backup | Sauvegarde | Sicherung | Backup | 백업 | 备份 | 備份 | Cadangan data | Yedek | id の「Cadangan」は「控え」と同じ語のため「Cadangan data」 | ja/en source, others draft |
| term.restore | 復元 | Restore | Restaurar | Restaurar | Restaurer | Wiederherstellen | Ripristina | 복원 | 恢复 | 還原 | Pulihkan | Geri yükle | | ja/en source, others draft |
| term.localData | このブラウザーのデータ | Data in this browser | Datos de este navegador | Dados deste navegador | Données de ce navigateur | Daten in diesem Browser | Dati in questo browser | 이 브라우저의 데이터 | 此浏览器中的数据 | 此瀏覽器中的資料 | Data di browser ini | Bu tarayıcıdaki veriler | サーバーへ送らないことが伝わる表現 | ja/en source, others draft |

## 6. 公開情報

| Key | ja | en | es | pt-BR | fr | de | it | ko | zh-CN | zh-TW | id | tr | Context / Notes | State |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| term.unofficial | 非公式 | Unofficial | No oficial | Não oficial | Non officiel | Inoffiziell | Non ufficiale | 비공식 | 非官方 | 非官方 | Tidak resmi | Resmi olmayan | 製品の説明（非公式のスカッド分析ツール）。省略しない | ja/en source, others draft |
| term.dataSource | データの取得元 | Data source | Fuente de datos | Fonte de dados | Source des données | Datenquelle | Fonte dei dati | 데이터 출처 | 数据来源 | 資料來源 | Sumber data | Veri kaynağı | | ja/en source, others draft |
| term.lastUpdated | 最終更新 | Last updated | Última actualización | Última atualização | Dernière mise à jour | Zuletzt aktualisiert | Ultimo aggiornamento | 마지막 업데이트 | 最后更新 | 最後更新 | Terakhir diperbarui | Son güncelleme | 日時は Intl.DateTimeFormat・日本時間の明示 | ja/en source, others draft |

## 7. 翻訳しないもの（固有の表記）

TeamAIXI・eFootball™・KONAMI・選手名・監督名・カード名・プレースタイルの名前・スキルの名前（ゲーム内の各言語の公式の表記が
データ元に無い限り）・利用者が入力したスカッド名・ビルド名・メモ・URL・メールアドレス・エラーコード・checksum・ファイル形式（JSON）。

## 8. 変更の記録

- 2026-10-06 pt-BR `defensiveEngagement`: 「Comprometimento defensivo」→「Empenho defensivo」（390・430px の育成画面で切れるため短くした）。
  ゲーム内の pt-BR の公式の表記と照合が必要（REVIEW_REQUIRED）。
- 2026-10-06 es・pt-BR `boosterModeStandard`: English のまま（"Standard"）だったため「Estándar」「Padrão」（`b3` の `standard` と同じ語）。
- 2026-10-07 fr・de・it・ko・zh-CN・zh-TW・id・tr の全文の AI 翻訳（RELEASE_CANDIDATE）。ゲームの用語は各言語の `locales/<locale>/game-terms.ts`
  （REVIEW_REQUIRED）。機能名は各言語の `nav` にそろえた（ko「내 팀・내 빌드」、it「Analisi delle build・Gestione dei dati・Cronologia diagnosi・Cockpit di confronto」）。
- 2026-10-07 it `progressionTab.remainingLabel`: 「Rimanenti」→「Restano」（430px の育成画面で選手名が切れるため）。
- 注意（全言語共通・レビューで決める）: 用語集は Link-Up Play・OVR に各言語の訳を載せているが、翻訳の指示は「訳さない」。今回の訳は指示に従い English のまま。
