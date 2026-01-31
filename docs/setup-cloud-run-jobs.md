# Cloud Run Jobs セットアップガイド

このドキュメントでは、Cloud Run Jobs を使ったバッチ処理のデプロイ手順を説明します。

> **前提条件**: [setup-guide.md](./setup-guide.md) の Step 1〜6 が完了していること

---

## 目次

1. [Cloud Run Jobs とは？](#cloud-run-jobs-とは)
2. [Step 1: Job 用トリガーを作成](#step-1-job-用トリガーを作成)
3. [Step 2: Job をデプロイ](#step-2-job-をデプロイ)
4. [Step 3: Job を手動で実行してテスト](#step-3-job-を手動で実行してテスト)
5. [Step 4: Cloud Scheduler で定期実行を設定（オプション）](#step-4-cloud-scheduler-で定期実行を設定オプション)
6. [トラブルシューティング](#トラブルシューティング)

---

## Cloud Run Jobs とは？

Cloud Run には 2 種類のリソースがあります：

| 項目 | Cloud Run Service | Cloud Run Jobs |
|------|-------------------|----------------|
| 用途 | API サーバー | バッチ処理 |
| 起動 | HTTP リクエスト | ジョブ実行（手動/スケジュール） |
| 終了 | 常時起動（リクエスト待機） | 処理完了で終了 |
| 課金 | リクエスト処理時間 | 実行時間のみ |
| 例 | Backend API, Frontend | 日次集計、ユーザー無効化 |

### 今回デプロイするジョブ

**非アクティブユーザーの自動無効化**

- 最終ログインから90日以上経過したユーザーを `is_active = false` に更新
- Cloud Scheduler と連携して毎日深夜に実行可能

---

## Step 1: Job 用トリガーを作成

### 1-1. Cloud Build を開く

1. GCP コンソール（https://console.cloud.google.com）にアクセス
2. プロジェクトを選択
3. 左メニュー →「CI/CD」→「Cloud Build」
4. 左メニュー →「トリガー」をクリック

### 1-2. トリガーを作成

1. 「トリガーを作成」をクリック
2. 以下を設定：

**基本設定**

| 項目 | 値 |
|-----|-----|
| 名前 | `job-deploy` |
| リージョン | `グローバル` |

**リポジトリ**

接続済みのリポジトリを選択（setup-guide.md の Step 6-4 で接続したもの）

**イベント**

| 項目 | 値 |
|-----|-----|
| イベント | `ブランチに push する` |
| ブランチ | `^main$` |

**ソース - フィルタ**

「フィルタを追加」をクリックして：

| 項目 | 値 |
|-----|-----|
| 含まれるファイル フィルタ (glob) | `backend-clean/**` |

> **注意**: Backend と同じフィルタです。Backend のコードが変更されたら Job もデプロイされます。

**構成**

| 項目 | 値 |
|-----|-----|
| タイプ | `Cloud Build 構成ファイル（YAML または JSON）` |
| ロケーション | `リポジトリ` |
| Cloud Build 構成ファイルの場所 | `backend-clean/cloudbuild-job.yaml` |

**サービスアカウント**

| 項目 | 値 |
|-----|-----|
| サービス アカウント | `xxxx-compute@developer.gserviceaccount.com` |

> `xxxx` はプロジェクト番号です。Backend デプロイと同じサービスアカウントを使用します。

3. 「作成」をクリック

---

## Step 2: Job をデプロイ

### 2-1. トリガーを実行

1. 「Cloud Build」→「トリガー」を開く
2. `job-deploy` の右側にある「実行」をクリック
3. ブランチは `main` を選択
4. 「トリガーを実行」をクリック

### 2-2. ビルドの確認

1. 「履歴」をクリック
2. 実行中のビルドをクリックして、ログを確認
3. 緑色のチェックマークが表示されれば成功

> **ビルドには 5〜10 分かかります。**

### 2-3. Job のデプロイを確認

1. 左メニュー →「Cloud Run」
2. 上部のタブで「ジョブ」をクリック
3. `deactivate-inactive-users` が表示されていれば成功

---

## Step 3: Job を手動で実行してテスト

### 3-1. Job を実行

1. 「Cloud Run」→「ジョブ」タブを開く
2. `deactivate-inactive-users` をクリック
3. 「実行」ボタンをクリック
4. 確認画面で「実行」をクリック

### 3-2. 実行結果を確認

1. 実行履歴の行をクリック
2. 「ログ」タブでログを確認
3. 以下のようなメッセージが表示されれば成功：

```
starting deactivation job for users inactive > 90 days
deactivated X users
job completed: X users deactivated
```

### 3-3. 冪等性の確認

同じジョブを再度実行すると：

```
starting deactivation job for users inactive > 90 days
deactivated 0 users
job completed: 0 users deactivated
```

既に無効化済みのユーザーは対象外となるため、何度実行しても安全です。

---

## Step 4: Cloud Scheduler で定期実行を設定（オプション）

毎日深夜に自動実行したい場合は、Cloud Scheduler を設定します。

### 4-1. Cloud Scheduler API を有効化

1. 左メニュー →「API とサービス」→「ライブラリ」
2. 「Cloud Scheduler」と検索
3. 「Cloud Scheduler API」をクリック
4. 「有効にする」をクリック

### 4-2. Cloud Scheduler を開く

1. 左メニュー →「統合」→「Cloud Scheduler」
2. または検索バーで「Cloud Scheduler」と検索

### 4-3. スケジューラを作成

1. 「ジョブを作成」をクリック
2. 以下を設定：

**基本設定**

| 項目 | 値 |
|-----|-----|
| 名前 | `deactivate-inactive-users-scheduler` |
| リージョン | `asia-northeast1` |
| 説明 | `90日以上ログインしていないユーザーを無効化` |

**スケジュール**

| 項目 | 値 |
|-----|-----|
| 頻度 | `0 3 * * *` |
| タイムゾーン | `Asia/Tokyo` |

> **cron 式の説明**: `0 3 * * *` = 毎日 03:00 に実行

**ターゲットの構成**

| 項目 | 値 |
|-----|-----|
| ターゲット タイプ | `HTTP` |
| URL | 下記参照 |
| HTTP メソッド | `POST` |

**URL の形式**:

```
https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/deactivate-inactive-users:run
```

`PROJECT_ID` は実際のプロジェクト ID に置き換えてください。

例：
```
https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/immortal-architecture-deploy/jobs/deactivate-inactive-users:run
```

**認証**

| 項目 | 値 |
|-----|-----|
| 認証ヘッダー | `OAuth トークンを追加` |
| サービス アカウント | `xxxx-compute@developer.gserviceaccount.com` |

3. 「作成」をクリック

### 4-4. Scheduler の動作確認

1. 作成したスケジューラ `deactivate-inactive-users-scheduler` をクリック
2. 「強制実行」をクリックしてテスト
3. 「Cloud Run」→「ジョブ」→「deactivate-inactive-users」で実行履歴を確認
4. 新しい実行が追加されていれば成功

---

## トラブルシューティング

### ビルドが失敗する

**エラー**: `PERMISSION_DENIED`

```
ERROR: (gcloud.run.jobs.deploy) PERMISSION_DENIED
```

**原因**: サービスアカウントに権限がない

**解決**:
1. 「IAM と管理」→「IAM」を開く
2. サービスアカウント `xxxx-compute@developer.gserviceaccount.com` を探す
3. 以下のロールが付与されているか確認：
   - `Cloud Run 管理者`
   - `Secret Manager のシークレット アクセサー`

---

### Job の実行が失敗する

**エラー**: `DATABASE_URL is not set`

**原因**: Secret Manager からシークレットを取得できない

**解決**:
1. 「Secret Manager」を開く
2. `DATABASE_URL` をクリック
3. 「権限」タブで `xxxx-compute@developer.gserviceaccount.com` にアクセス権があるか確認

---

### Scheduler の実行が失敗する

**エラー**: `403 Forbidden`

**原因**: Scheduler のサービスアカウントに Cloud Run Jobs の実行権限がない

**解決**:
1. 「IAM と管理」→「IAM」を開く
2. Scheduler で使用しているサービスアカウントに `Cloud Run 起動元` ロールを付与

---

## 関連ドキュメント

- [セットアップガイド](./setup-guide.md) - 初期セットアップ手順
- [ジョブ処理設計ガイド](../backend-clean/docs/10_batch_job_design.md) - 実装の詳細
- [バッチ処理入門ガイド](../backend-clean/docs/11_batch_processing_guide.md) - バッチ処理の基本概念
- [サービスアカウントガイド](../backend-clean/docs/12_service_account_guide.md) - 権限設定の詳細
