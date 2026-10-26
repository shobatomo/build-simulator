# 内部データ保存・Bebop 単発計算（2026-10-23）

> 更新: 2026-10-26 に専用 PostgreSQL 16 で保存・復旧・競合の 14 項目を検証し、cluster を停止しました。以下の当初の未検証記述については [最新結果](postgresql-validation.md) を参照してください。Supabase PG17 / PostgREST と本番有効化は未完了です。

2026-10-26 追記: [保存済み snapshot の復旧案](asset-recovery.md) と、メモリ内 SQL・
実 SDK の mock RPC 接続テストを追加した。管理者向けの未適用案であり、実 DB・
アプリ権限・読取経路・UI・本番配信は引き続き変更していない。

今回は内部モジュールとローカル SQL 案を実装した。対戦計算 UI、既存 API
ルート、同期認証、DB、環境変数、本番配信は変更しない。
既存の GET 書込み禁止・POST fail-closed・component_items による入替処理を維持する。

## データと保存の境界

- `src/server/deadlockSnapshot.ts`: 明示した client_version の公開 Assets API
  5 文書を GET し、元 JSON・取得時刻・URL・言語・SHA-256 を保持する既存 adapter。
- `src/server/versionedAssetStore.ts`: 検証、正規化、更新の調整、注入された
  Supabase 互換 RPC client による repository。環境変数の読出し、client 作成、
  自動実行、API endpoint 登録は行わない。
- `docs/migrations/versioned-assets-proposal.sql`: 新規 3 テーブルと 2 RPC の
  **未適用・未登録の案**。6 月の既存テーブル・データは参照も更新もしない。

更新は次の順で実行する。

1. 現在の正常データを読み、raw のハッシュと正規化結果を再検証する。
2. 指定バージョンを取得する。片方の言語・コレクションの取得失敗、空配列、
   ID/class_name 不整合、チェックサム不一致、版の混在・巻戻りは拒否する。
3. 既存カタログにあった ID の消失も拒否する。正当な削除は別途レビューが必要。
4. 内容が同一なら書き込まない。違う場合は expectedRevision を渡し、raw、
   正規化結果、active pointer を **1 PostgreSQL transaction** で保存する。
5. SQL は advisory transaction lock と revision の比較で更新競合を防ぐ。
   途中エラーは全ロールバックし、以前の active pointer を残す。
6. 書込み応答が失われた場合は 1 回だけ読戻す。同じ候補が active なら成功、
   前版なら失敗、別更新なら競合、読戻しも失敗なら `uncertain`。盲目的に再送しない。

`observedActive` は最後に確認できた状態であり、その後の他処理による更新を
保証しない。最初の取得では「全 ID が返った」ことを既存集合と比較できないため、
初回の件数・対象確認は運用手順に残す。以後は ID 消失を自動拒否する。
配列を返す API 自体には独立した版番号がなく、要求 URL と steam-info manifest
の契約に基づく同一版チェックである。

raw/normalized テーブルはアプリ用 service_role に SELECT/INSERT のみを許可する。
active pointer のみ UPDATE を許可し、3 テーブルの RLS を有効にする。anon と
authenticated は読取・更新・RPC 実行を許可しない。RPC は SECURITY INVOKER、
空 search_path、スキーマ修飾を使用する。サービス client は特権のある信頼境界であり、
この案は DB owner/service_role 自体を敵対者として隔離するものではない。
SQL は外部の JSON ハッシュを再計算しないため、必ず検証付き repository を経由する。

## normalizer 0.2.0

JSONB は object のキー順を保持しない。0.1.0 では property 配列の順序と一部の
ロケール差分診断がキー順の影響を受けたため、0.2.0 では property key を整列し、
ロケール値をキー順によらず比較する。SQL 保存→読戻し→再正規化の往復で検証した。
元の値・未知値・条件・倍率・強化段階・ローカライズは従来通り保持する。
0.1.0 の保存結果を上書きしない。将来その保存結果が存在する場合は、同じ raw
から 0.2.0 の別行を作成する承認済み手順が必要（現在の reader は 0.2.0 のみ対応）。

## 計算の対応範囲

`src/domain/buildCombat.ts` の `assembleBuild` と `calculateBuildImpact` は
取得・保存・UI に依存しない純粋関数。攻撃側 build/context、防御側 build/context、
攻撃種別、計算条件を分離した。結果には対応状態、根拠となる値とパス、前提を返す。
両 build はカタログと同じ clientVersion / normalizerVersion / snapshot hash が必要。

現行の計算プロファイルは `bebop-single-impact-6819-v1`。6819 / 0.2.0 の
レビューした API フィールドに限定し、未知のアイテムや新しい機械的条件・効果が
見つかれば数値を出さない。`src/domain/bebopRules.ts` はその照合用データであり、
任意の API フィールドを実行可能な式へ変換するものではない。

| 項目 | 対応と前提 |
| --- | --- |
| ヒーロー | Bebop（ID 15）のみ。level_info の use_standard_upgrade が有効な段階を数える |
| 成長 | API の基礎 HP・1 段階の HP/スピリット/射撃/耐性成長値を加算する仮定 |
| アイテム | Extra Health、Extra Spirit、Bullet Resilience、Spirit Resilience の未強化状態のみ |
| アイテム強化 | 選択した全アイテムの段階 0 を明示する。段階不明は incomplete、1 以上は unsupported |
| 射撃 | 本体命中 1 発、距離 0。beam の DPS、発射周期、falloff のゲーム内単位変換は対象外 |
| Sticky Bomb | 1 対象への爆発 1 回、恒久蓄積 0、段階 0–2。Damage + 段階の Damage bonus + Spirit × stat_scale |
| Bomb の対象外 | 段階 3、蓄積、他の範囲内対象、自傷、起爆までの状態変化 |
| 防御 | 満 HP、指定した該当シールド、最終耐性。単発で耐性適用後にシールド、次に HP を消費する仮定 |
| Resilience | 満 HP 時の innate 耐性のみ。HP 条件効果と命中途中の閾値跨ぎは再計算しない |
| 耐性重複 | 非ゼロ源が複数なら unsupported。明示された最終耐性がある場合だけ使用し、重複式は推測しない |
| その他 | 頭部、貫通、増幅、proc、複雑な状態変化、DPS/TTK は unsupported |

API の hero starting_stats にない基礎スピリット・基礎耐性・シールドは呼出側が
明示する。未指定を 0 にしない。数値が出ても常に `assumption-based` であり、
実ゲームと一致する測定済み値ではない。既存 `combat.ts` は明示値の計算器として
保持し、新しい wrapper が計算済み値を渡す。内側の「build は出典のみ」という
説明はその低レベル計算器の責務を示す。

### 購入ボーナスの未解決点

6819 の cost_bonuses は gold_threshold / bonus / percent_on_graph を返すが、
OpenAPI は bonus の単位や適用順を説明していない。購入済みアイテムの cost 合計と
該当閾値は証拠として返すが、実際の売買履歴や加算/乗算を確定しない。
アイテムを持つ場合、呼出側が解決済みの HP・スピリット・射撃の総追加分を
`purchaseContributions` へ明示する必要がある。null は incomplete。テスト中の
0 指定は「購入ボーナスを 0 とした比較条件」であり、ゲームの仕様ではない。

## 公開 API の証拠

2026-10-23 04:03 UTC に公開 GET で取得した client_version **6819** の全体は
heroes 65 / items 781。全 5 文書から作った raw/catalog の検証が成功した。
正規化で未知値 51 件を保持し、0 へ置換しなかった。

`tests/fixtures/bebop-6819.public.json` はその応答から選択した、Bebop と 7 item
レコードの英日原文。完全なゲームカタログではない。Improved Spirit は構成元競合・
未対応の確認用であり計算対応アイテムではない。取得版と出典は fixture に記録した。

確認例（購入ボーナス 0、基礎値・シールド等を明示したテスト条件）:

- Lv2 Bebop: HP 880 + 52 = 932、スピリット 0 + 1.1、射撃 4.98 + 0.115。
- Extra Spirit を持つ Bomb 段階 2: (85 + 85) + 10 × 1.5 = 185。
- 対象のスピリット耐性 30%、シールド 10: 185 × 0.7 = 129.5、HP 消費 119.5。

参照: [Assets OpenAPI](https://api.deadlock-api.com/openapi.json)、
[Supabase Database Functions](https://supabase.com/docs/guides/database/functions)、
[Supabase RPC](https://supabase.com/docs/reference/javascript/rpc)、
[PGlite in-memory database](https://pglite.dev/docs/)。

## 検証と導入前に必要な操作

`npm test` は既存の保護/アップグレード選択テストと、新しい同期・計算テストを実行する。
SQL は pinned devDependency `@electric-sql/pglite@0.5.11` の **メモリ内 PostgreSQL**
で実行する。実 DB、資格情報、.env、同期 API へのアクセスはない。
CAS 競合テストは PGlite の単一接続で競合する期待 revision を検証するもので、
実 Supabase/PostgREST の複数セッションや通信、ロール構成を再現するものではない。

本番導入は未実施。次回は具体的に次を承認・確認する必要がある。

1. 既存 DB の同名オブジェクト不存在、PostgreSQL 版、service_role の RLS bypass、
   権限を読み取り確認する。既存テーブルを変更する SQL に混ぜない。
2. Supabase CLI を利用できる環境で `supabase migration new versioned_asset_snapshots`
   により案を正式登録し、独立した検証 DB で適用と実 RPC の往復を確認する。
3. 本番 SQL 適用を別途承認後、新規オブジェクトだけを作成する。初回の候補版、
   件数、raw/catalog、差分を確認してから保存・active 切替を承認する。
4. 検証済み client を repository に注入し、既存認証を維持した管理用処理へ接続する。
   公開 GET から同期させない。認証・環境変数の変更や同期有効化は別途承認が必要。
5. 新カタログの読取経路を接続し、障害時に最後の正常版を提供できることを検証する。
   現在の画面/API は従来経路を使っており、この新しいストアへはまだ接続していない。
6. 同じゲーム版の実測で成長・購入ボーナス・重複耐性・シールド順を確認し、対応範囲を
   広げる。自分/相手を設定する UI は実装前にユーザーと相談する。
