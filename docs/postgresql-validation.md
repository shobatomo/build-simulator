# PostgreSQL 16 の分離検証結果

2026-10-26。公開 fixture のみを使い、専用の一時 cluster で **14 項目成功**。
既存 PostgreSQL、Supabase、OS service、アプリの環境設定は変更していない。

## 実行環境と停止

- PostgreSQL 16.0、Windows。
- 専用 Temp の `deadlock-pg16-validation-20261026/data`。
- `127.0.0.1:55432` のみ。専用管理者だけを loopback trust で許可。
- 専用 DB `deadlock_validation`。anon/authenticated/service_role は NOLOGIN。
  service_role は Supabase の再現用に BYPASSRLS、各ロールを SET ROLE して検証。
- 秘密・パスワードは作成していない。サービス登録・自動起動なし。
- 終了時に pg_ctl stop が成功し、status は終了コード 3（停止）を確認。
  data とログを保持。起動中は同じ PC のプロセスも管理者名で接続できる条件を承認済み。

最初の実行は Windows の pg_ctl 子プロセスが pipe を保持して完了待ちになった。
専用 cluster の停止を確認後、検証器の完了判定とパス区切り照合を修正した。
再初期化・データ消去はせず、作成証跡と設定が一致する同じ専用 cluster で試験を完了。
これはアプリや SQL の修正ではなく検証器の修正。初回の失敗記録も保存した。

## 確認したこと

1. 接続先の address/port/data_directory/user/version を照合。
2. 保存 SQL と復旧 SQL を空の専用 DB のみに適用。
3. A 保存 → B 保存 → A 復旧で、両 snapshot を保持し revision 1→2→3。
4. 復旧 operation ID の再送は既存 receipt を返し、後続の公開を巻き戻さない。
5. 古い expected revision の公開を 40001 で拒否し、行と pointer を保持。
6. pointer 更新後の transaction エラーで追記行と pointer がともに rollback。
7. publish/publish の別セッション競合で advisory lock 待機を観測。勝者だけが commit、敗者 40001。
8. restore/restore も同様。
9. publish/restore も同様。
10. lock_timeout は 55P03、部分適用なし。
11. statement_timeout は 57014、部分適用なし。
12. commit 前の接続切断で全 rollback。
13. commit 後の応答喪失を模擬し、実 DB を一度再読取して成功を確認。重複 publish なし。
14. anon/authenticated の読取、service_role の復旧・snapshot 更新/削除を 42501 で拒否。

終了時は snapshot 6、normalized 6、復旧 receipt 2、active revision 8。
各 snapshot は同じ公開 API 6819 fixture の名前を明示的に変更した検証データ。
実ゲームのバージョン差や数値精度を示すデータではない。

## 公開範囲と未検証

今回公開できるのは基盤コードと、明示設定時だけ新保存方式を読む API 接続。
本番の `DEADLOCK_ASSET_READ_MODE` は設定しないため、既存の読み取り経路を維持する。
同期の認証や環境変数も変更しない。新方式への書込み API は有効化しない。
比較ダメージ UI とユーザーの未コミット UI 変更は公開範囲に含めない。

PG16 の結果は実 Supabase PG17 / PostgREST の確認を代替しない。
新方式の本番有効化には、対象 DB の確認、SQL・role/grant の適用承認、
保存先への検証済みデータ投入、実 RPC と表示の確認、切戻し手順の確認が必要。
新資格情報や本番権限をこの試験の承認で作成・変更しない。
復旧は削除や revision 巻戻しではなく、exact stored bundle と current revision の CAS で行う。

詳細な作成オブジェクトと手順は [API 接続手順](versioned-api-integration.md)、
復旧の保証と制約は [復旧手順](asset-recovery.md) を参照。
