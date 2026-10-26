# 保存済み snapshot の復旧（ローカル案・2026-10-26）

> 更新: 2026-10-26 に専用 PostgreSQL 16 で保存・復旧・競合の 14 項目を検証し、cluster を停止しました。以下の当初の未検証記述については [最新結果](postgresql-validation.md) を参照してください。Supabase PG17 / PostgREST と本番有効化は未完了です。

実装済みなのは、SQL 案・パラメータ検証・隔離テストまで。実 DB への適用、
実 RPC、同期、秘密の読取や配置、アプリの権限追加、画面・本番配信は行っていない。

## 通常の更新と復旧を分ける

通常の `publish_deadlock_asset_release` はゲーム版の巻戻りを拒否する。
`docs/migrations/asset-recovery-proposal.sql` は明示的な管理者操作だけに使う別案。
`versioned-assets-proposal.sql` の新規 3 テーブルが先に存在する必要がある。
どちらも正式登録前の案であり、実 DB の migration 履歴を変更していない。

復旧案は `deadlock_admin` スキーマ、操作履歴テーブル、
`deadlock_admin.restore_asset_release` 関数を追加する。関数は SECURITY INVOKER、
空 search_path。新しい GRANT はなく、PUBLIC／anon／authenticated／service_role
からアクセスを取り除いた owner 向け SQL である。既存アプリの service client では
呼べず、公開 RPC や Data API の追加スキーマとして登録していない。
管理者権限自体を隔離する仕組みではないため、owner の操作は引き続き承認対象。

復旧先は **保存済み raw と正規化結果の完全な組**。新しい API 再取得結果ではない。
`src/server/assetRecovery.ts` の `prepareAssetRecovery` がハッシュ、版、正規化結果、
期待 revision、操作 ID、理由を検証し、入力から切り離した SQL パラメータを返す。
ネットワーク、DB client、環境変数へのアクセスはしない。
現在の normalizer 対応は 0.2.0 のみ。古い正規化結果を無断で再生成しない。

## 復旧の保証と限界

1. 通常の公開処理と同じ advisory transaction lock を使う。
2. 保存済み raw/catalog と受け取った候補を完全一致で照合する。
3. 現在の revision が期待値と一致しなければ拒否する。
4. 切替時は revision を 1 増やす。過去の番号に戻さない。
5. 切替前後の snapshot、正規化版、revision、理由、DB ロール、時刻、操作 ID を
   履歴に残す。切替と履歴保存は同じ transaction。片方の失敗で両方戻る。
6. 同じ操作 ID・同じ引数の再送は既存の履歴を返し、再度切り替えない。
   同じ ID を異なる復旧内容に使うことは拒否する。

現在と同じ snapshot を指定した場合は明示的な no-op を記録し、revision は増やさない。
元の raw/catalog、古い版、6 月の既存テーブルは更新・削除しない。

返却値の `operation.applied_revision` は **過去にその操作が完了した revision**。
`active` は今回の呼出し時点のデータ。操作後に別の公開があれば両者は異なる。
`replayed: true` を「今も復旧先が active」と読み替えてはいけない。
アプリケーションの履歴全体を監査するテーブルではなく、今回追加した履歴は復旧専用。
通常公開の全 revision を記録する運用履歴は別課題である。

SQL 自体は JavaScript の canonical JSON SHA-256 を再計算しない。
必ず `prepareAssetRecovery` を通し、保存済み内容との照合も確認する。
データの復旧成功はゲーム計算の正確性を保証しない。復旧先のゲーム版が計算
プロファイルで未対応なら、内部計算は従来どおり unsupported を返す。

## 今回の検証

`npm test` に以下を追加した。追加依存はない。

- `tests/asset-recovery.test.mjs`: PGlite のメモリ内 PostgreSQL で、正常復旧、
  旧版拒否の維持、revision 競合、候補不一致、正常化版不一致、no-op、操作 ID 再送、
  後続公開の保全、履歴保存失敗時の全ロールバック、アプリ用ロールの拒否を確認。
- `tests/asset-rpc-transport.test.mjs`: インストール済み `@supabase/supabase-js` を
  実際に使い、fetch だけを mock に置換。read/publish RPC の URL・HTTP method・
  JSON 引数・応答を確認し、メモリ DB まで往復する。401/403/404/500、不正 JSON、
  改変された成功応答、保存応答の喪失も確認する。

`.invalid` ドメインと固定のダミー文字列を SDK のテスト入力に使う。実資格情報の
生成・読出し・設定はなく、外部 fetch や既存の同期ルートも呼ばない。
復旧関数は owner 向け SQL のみを検証しており、復旧を REST API 経由で公開する
テストや実装ではない。

PGlite は単一接続を直列処理するため、競合テストは expected revision の拒否を
確認するもの。実 PostgreSQL の複数セッション、ロック待ち・timeout、PostgREST
の schema cache、実プロジェクトのロール・ネットワーク・容量は未検証。

## 実環境へ進む前の手順（未実行）

1. 対象の検証 DB を明示し、既存同名オブジェクト、migration 履歴、版、所有者、
   権限を読み取り確認する。本番と取り違えない。CLI 利用時は version と help を
   確認してから migration new で案を正式登録する。既存 6 月 migration を再実行しない。
2. **別途承認後**、独立した検証 DB に元の保存案と今回の復旧案を適用する。
   実 PostgreSQL の複数接続で publish と restore を競合させ、片方だけの成功、
   切替・履歴の原子性、ロール拒否、実 SDK / PostgREST の往復を確認する。
3. 本番適用・データ操作はさらに対象と内容を確定して承認を得る。既存テーブルや
   履歴を DROP/RESET して導入しない。同名オブジェクトがあれば処理を止めて差分を確認する。
4. 復旧が必要になったら、現在 revision、保存済み復旧先の client_version・hash・
   normalizer、操作 ID、理由を固定してレビューする。候補を prepareAssetRecovery
   で検証後、承認された owner 接続からパラメータ付き SQL として 1 回実行する。
5. 応答が不明ならまず操作 ID の履歴と active を読み取り確認する。処理済みかを
   確認せず新しい ID で再実行しない。同じ ID の再送も認可範囲を確認してから扱う。
6. 成功後は applied_revision と active の一致、対象 snapshot、読取互換性を確認する。
   後続更新が見つかっても自動で再復旧しない。正規化版変更時には reader と復旧 SQL の
   対応版をまとめてレビューする。旧 snapshot を上書きしない。

資格情報の用意、実 DB 書込み、アプリ用の新しい復旧権限、公開 endpoint、
環境変数・デプロイ変更はこのローカル案の実行に含めない。

参照: [Supabase functions](https://supabase.com/docs/guides/database/functions)、
[RPC client](https://supabase.com/docs/reference/javascript/rpc)、
[PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)。
