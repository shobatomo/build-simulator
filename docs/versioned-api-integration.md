# バージョン付き保存データの API 接続（ローカル準備）

2026-10-26。承認済みの専用 PostgreSQL 16 で保存・復旧・競合を検証済み。
Supabase への適用・本番設定変更は未実施。[実 DB 検証結果](postgresql-validation.md) を参照。

## 接続範囲

`DEADLOCK_ASSET_READ_MODE` はサーバーだけで参照する非秘密の切替値。
今回の変更では環境変数を作成・設定しない。

| 値 | GET の動作 | 同期 POST |
| --- | --- | --- |
| 未設定、`legacy` | 従来どおり。全体取得は上流 API → 旧保存データへのフォールバック、個別取得は旧表 | 従来の fail-closed 認証を維持 |
| `versioned` | `read_deadlock_asset_release()` の保存済み 1 組だけを検証して返す | 503 `VERSIONED_SYNC_DISABLED`。既存の同期認証があっても旧表を書かない |
| 空文字、その他 | 503 `ASSET_READ_MODE_INVALID`。外部アクセスなし | 503。外部アクセスなし |

対象は `/api/sync/deadlock-data-first` GET、`/api/heroes` GET、`/api/items` GET。
新方式で DB 設定不足、関数不存在、権限不足、active 未作成、破損、未対応 normalizer、
表示対象なしの場合は 503 `VERSIONED_DATA_UNAVAILABLE`。旧表・上流 API には戻さない。
GET から publish/sync/restore を呼ばない。Supabase の read RPC は HTTP POST だが SQL は SELECT のみ。
エラー詳細や資格情報は応答・ログへ出さない。新経路の応答は `Cache-Control: no-store`。

既存画面が使用する全体 GET は単一 RPC の結果から両コレクションを作る。
個別 GET を別々に呼ぶ場合は間に切替が起き得るため、metadata の revision/hash を比較する。
`clientVersion` / `normalizerVersion` / `snapshotHash` / `revision` を応答 metadata に含める。
UI や対戦計算 UI は変更していない。新しい保存先への同期を公開 API へ接続してもいない。

## 表示と計算の境界

元 JSON と正規化データは全件保持し、既存 formatter を表示用途にだけ再利用する。
既存 formatter の数値補完・未検証計算は残るため `displayModel: legacy-unverified` と警告を返す。
これは内部の厳格な計算モデルへ UI を移行したという意味ではない。

表示ポリシー `selectable-release-v1` は、ヒーローの `player_selectable=true`、
`disabled=false`、`in_development=false`、`development_state=release` を明示的に要求する。
上流の `only_active` と同じ定義だと断定しない。欠けたフラグは非表示にする。
アイテムは既存の shopable な upgrade に、既知の weapon/vitality/spirit 枠と disabled 除外を追加。
Upgrade.disabled は optional（保存済み OpenAPI）で、6819 の実レスポンスは省略している。
省略時は明示的な shopable=true を使い、disabled=true または null/不正値は表示しない。
component_items は非表示・非販売の候補も含む全件から解決してから表示を絞る。
日本語名と能力の取得も同じ snapshot 内から行う。

snapshot に `/icons` 文書はないため装飾用 icons は空の categories/stats を返す。
ヒーロー・アイテム個別の画像は保存済み URL を維持する。未固定の icons API を混ぜない。
表示件数の除外数と警告を metadata に残す。raw/catalog は応答へ丸ごと出さない。
読取のたびに整合性検証と表示変換を行う。全件データの負荷測定・キャッシュ設計は今後の課題。

## 実 DB 検証の対象と保留点

PC には `C:\Program Files\PostgreSQL\16\bin` の PostgreSQL 16.0 がある。
PATH に psql/postgres/pg_ctl/initdb、Docker、Supabase CLI はない。
バージョンと initdb/pg_ctl の help を確認後、承認された専用 cluster で検証した。
既存 data ディレクトリ、接続情報、秘密は読んでいない。
サービス一覧の取得は OS の Service Control Manager 権限エラーで失敗。再試行していない。
対象プロセス名の読み取りでは PostgreSQL/Docker を確認できなかったが、接続可能な DB が
存在しないことまで証明していない。

Supabase `dribvpgojmsjjttwecgz` は用途未確定で既存データあり。適用先には選ばない。
以下のローカル環境作成計画は、その後の承認を得て PG16 で実施完了した。
実 Supabase の SQL・認証・権限設定への適用は別途承認待ちである。

1. 既存 data や Windows service を使わず、新規 Temp 下の専用 data ディレクトリに初期化。
   初期化先、ループバックのみの listen address、空き port、停止方法を作業前に固定する。
2. その検証 cluster だけの認証方式とロール作成を承認対象にする。ローカル trust は同じ PC の
   他プロセスも接続可能になるため無断で選ばない。資格情報生成や配置も別途承認が必要。
3. 接続後に current_database、server_version、inet_server_addr/port、data_directory を照合。
   本番 URL や既存 data と一致したら中止。PG16 の検証結果を本番 PG17 と同一とは扱わない。
4. 空の検証 DB に限り、Supabase 互換の fixture ロールと 2 SQL 案を適用。
   旧 6 月 migration は再実行しない。CLI がないため正式 migration 登録も未実施。
5. SQL・RPC 検証後にその cluster だけ停止する。既存プロセスやサービスは停止しない。
   証跡を保存し、data の削除は別途対象を確認してから。共有 DB の DROP/ロール変更は行わない。

## SQL の作用と衝突確認用の名前

`docs/migrations/versioned-assets-proposal.sql` → `asset-recovery-proposal.sql` の順。
今回この 2 案の SQL は変更していない。

- 作成 table: `public.deadlock_asset_snapshots`、`public.deadlock_normalized_snapshots`、
  `public.deadlock_active_asset_release`、`deadlock_admin.asset_recovery_operations`。
- 作成 schema: `deadlock_admin`。
- 作成 function: `public.read_deadlock_asset_release()`、
  `public.publish_deadlock_asset_release(jsonb,jsonb,bigint)`、
  `deadlock_admin.restore_asset_release(uuid,bigint,jsonb,jsonb,text)`。
- 明示的 CREATE INDEX はない。PK/UNIQUE から以下が生成される：
  `deadlock_asset_snapshots_pkey`、`deadlock_asset_snapshots_client_version_content_hash_key`、
  `deadlock_asset_snapshots_id_client_version_content_hash_key`、
  `deadlock_normalized_snapshots_pkey`、`deadlock_active_asset_release_pkey`、
  `asset_recovery_operations_pkey`。

保存用 3 表は RLS 有効、service_role に必要な append/read/pointer 更新と関数 execute を付与する案。
復旧 schema/table/function は owner 専用で application role へ GRANT しない。
既存 5 表は更新しない。raw/normalized は追記、active pointer だけ CAS と共通 advisory lock で切り替える。
SQL 適用には権限変更が含まれるため、対象の承認前には実 DB へ実行しない。

## 実 DB 検証項目と戻し方

- 保存 A → 保存 B → A 復旧を実行し、全 raw/catalog を保持、revision 1→2→3 と履歴を確認。
- 異なる 2 セッションで同じ expected revision を使う publish/publish、publish/restore、restore/restore。
  一方が lock を保持中に他方が待機し、commit 後に他方が 40001 になることを確認。
  最終 active、revision、追記行数、復旧 receipt に部分適用がないことも確認。
- statement_timeout / lock_timeout と切断時に rollback されること、応答喪失後の再読取と
  同一復旧 operation ID の再送が追加切替を起こさないことを確認。
- anon/authenticated/service_role/owner の実権限を確認。復旧を PostgREST へ公開しない。
- PostgreSQL 単体では PostgREST schema cache、実 Supabase 権限・SDK通信は検証できない。
  その確認には別の承認済み検証 Supabase/REST 環境が必要。

データの戻し方は `docs/asset-recovery.md` の exact stored bundle と現 revision を使う owner 復旧。
検証済み `prepareAssetRecovery` でパラメータを作り、競合時は止めて再読取する。
古い snapshot を削除したり、revision を過去値に書き戻したりしない。
アプリの切戻しは、別途承認された設定変更で read mode を legacy に戻す。
その際は旧同期 POST の認証設定も再確認する（legacy に戻すと従来の認証条件へ戻るため）。
DB オブジェクトを DROP する必要はない。既存データと新 snapshot を保持したまま読み取り経路を戻す。

## ローカル検証

`tests/versioned-api.test.mjs` は環境を fixture に限定し、外部 fetch を禁止。
実 Supabase SDK + mock fetch + PGlite の保存済みデータから API 形式まで確認する。
既存の保護・復旧・アップグレード・計算テストも維持する。
公開 API 6819 の保存済み全件（heroes 65 / items 781）もネットワークアクセスなしで変換確認する。
このポリシーでは heroes 42 / items 173 を表示し、元データ全件は保持する。
PGlite は単一接続。複数 OS プロセスのロック検証は別途 PG16 で実施済み。
Next build は `.env` を含めない Temp コピーと最小限のプロセス環境で実行する。
