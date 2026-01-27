# セットアップガイド

このドキュメントでは、immortal-architecture を Google Cloud にデプロイするための手順を説明します。

> **対象者**: GCP を初めて使う方、Cloud Run でのデプロイが初めての方

---

## 目次

1. [全体の流れ](#全体の流れ)
2. [事前準備](#事前準備)
3. [Step 1: Neon データベースの作成](#step-1-neon-データベースの作成)
4. [Step 2: Migration の実行](#step-2-migration-の実行)
5. [Step 3: GCP プロジェクトの作成](#step-3-gcp-プロジェクトの作成)
6. [Step 4: Secret Manager の設定](#step-4-secret-manager-の設定)
7. [Step 5: Artifact Registry の設定](#step-5-artifact-registry-の設定)
8. [Step 6: Cloud Build トリガーの設定](#step-6-cloud-build-トリガーの設定)
9. [Step 7: 初回デプロイ](#step-7-初回デプロイ)
10. [Step 8: Google OAuth の設定](#step-8-google-oauth-の設定)
11. [Step 9: 動作確認](#step-9-動作確認)

---

## 全体の流れ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          セットアップの流れ                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Step 1        Step 2        Step 3        Step 4        Step 5           │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐           │
│  │  Neon  │   │Migration│   │  GCP   │   │ Secret │   │Artifact│           │
│  │  DB    │──▶│  実行   │──▶│Project │──▶│Manager │──▶│Registry│           │
│  │  作成  │   │(テーブル)│   │  作成  │   │  設定  │   │  設定  │           │
│  └────────┘   └────────┘   └────────┘   └────────┘   └────────┘           │
│                                                                             │
│   Step 6        Step 7        Step 8        Step 9                          │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐                         │
│  │ Cloud  │   │  初回  │   │ Google │   │  動作  │                         │
│  │ Build  │──▶│デプロイ│──▶│ OAuth  │──▶│  確認  │                         │
│  │トリガー│   │        │   │  設定  │   │        │                         │
│  └────────┘   └────────┘   └────────┘   └────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**所要時間の目安**: 約 60〜90 分

---

## 事前準備

### 必要なアカウント

以下のアカウントを事前に作成してください。

| サービス | 用途 | 作成 URL |
|---------|------|----------|
| **Google アカウント** | GCP の利用 | https://accounts.google.com |
| **GitHub アカウント** | ソースコード管理 | https://github.com |
| **Neon アカウント** | データベース | https://neon.tech |

### リポジトリの準備

本教材では以下のリポジトリを使用します：

```
https://github.com/YukiOnishi1129/immortal-architecture-deploy
```

> **注意**: 実際の開発では、各自の GitHub リポジトリを使用してください。

---

## Step 1: Neon データベースの作成

Neon はサーバーレスの PostgreSQL データベースサービスです。無料枠で十分に使えます。

### 1-1. Neon にサインアップ

1. https://neon.tech にアクセス
2. 「Sign Up」をクリック
3. GitHub または Google アカウントでサインアップ

### 1-2. プロジェクトを作成

1. ダッシュボードで「New Project」をクリック
2. 以下を設定：

| 項目 | 値 |
|-----|-----|
| Project name | `immortal-architecture` |
| Postgres version | `17`（最新を選択） |
| Region | `Asia Pacific (Singapore)` |

3. 「Create Project」をクリック

### 1-3. 接続文字列をコピー

プロジェクト作成後、ダッシュボードから接続文字列を取得します。

1. プロジェクトのダッシュボードを開く
   - URL: `https://console.neon.tech/app/projects/[プロジェクトID]`
2. 画面右側の「Connection string」セクションを探す
3. 接続文字列をクリックすると、文字列全体が表示される
4. 「Copy」ボタンをクリックしてコピー
5. メモ帳などに保存しておく

```
postgresql://username:password@ep-xxxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

> **重要**: この文字列にはパスワードが含まれています。絶対に他人に見せないでください。

---

## Step 2: Migration の実行

データベースにテーブルを作成します。初回セットアップ時に一度だけ実行します。

> **注意**: Migration は新しいテーブルやカラムを追加するときのみ実行します。通常の開発・デプロイでは実行不要です。

### 2-1. GitHub Secrets に DATABASE_URL を設定

1. GitHub のリポジトリページを開く
   - URL: `https://github.com/YukiOnishi1129/immortal-architecture-deploy`
2. 「Settings」タブをクリック
3. 左メニュー →「Secrets and variables」→「Actions」
4. 「New repository secret」をクリック
5. 以下を入力：

| 項目 | 値 |
|-----|-----|
| Name | `DATABASE_URL` |
| Secret | Step 1 でコピーした Neon の接続文字列 |

6. 「Add secret」をクリック

### 2-2. Migration を手動実行

1. GitHub のリポジトリページで「Actions」タブをクリック
2. 左メニューから「Database Migration」を選択
3. 「Run workflow」をクリック
4. 「Run workflow」をクリック
5. 実行が完了するまで待つ（緑色のチェックマークが表示されれば成功）

> **確認**: Neon のダッシュボードでテーブルが作成されていることを確認できます。

---

## Step 3: GCP プロジェクトの作成

### 3-1. Google Cloud Console にアクセス

1. https://console.cloud.google.com にアクセス
2. Google アカウントでログイン

### 3-2. 新しいプロジェクトを作成

1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. 「新しいプロジェクト」をクリック
3. 以下を入力：

| 項目 | 値 |
|-----|-----|
| プロジェクト名 | `immortal-architecture` |
| 場所 | `組織なし`（個人の場合） |

4. 「作成」をクリック

### 3-3. プロジェクトを選択

1. 作成完了後、通知の「プロジェクトを選択」をクリック
2. または上部のドロップダウンから `immortal-architecture` を選択

### 3-4. 課金を有効化

Cloud Run などを使うには課金の有効化が必要です（無料枠内なら請求されません）。

1. 左メニュー →「お支払い」をクリック
2. 「請求先アカウントをリンク」をクリック
3. 請求先アカウントを選択（なければ新規作成）
4. 「アカウントを設定」をクリック

> **注意**: 無料枠を超えると課金されます。学習目的なら、終わったらリソースを削除してください。

### 3-5. 必要な API を有効化

以下の API を有効にします。

1. 左メニュー →「API とサービス」→「ライブラリ」

2. 以下の API を検索して、それぞれ「有効にする」をクリック：

| API 名 | 検索キーワード |
|-------|---------------|
| Cloud Build API | `cloud build` |
| Cloud Run Admin API | `cloud run` |
| Artifact Registry API | `artifact registry` |
| Secret Manager API | `secret manager` |

> **ポイント**: 各 API のページで「有効にする」ボタンをクリックするだけです。

---

## Step 4: Secret Manager の設定

Secret Manager は、パスワードや API キーなどの機密情報を安全に保存するサービスです。

### 4-1. Secret Manager を開く

1. 左メニュー →「セキュリティ」→「Secret Manager」
2. または検索バーで「Secret Manager」と検索

### 4-2. DATABASE_URL を作成

1. 「シークレットを作成」をクリック
2. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 名前 | `DATABASE_URL` |
| シークレットの値 | Step 1 でコピーした Neon の接続文字列 |

3. 「シークレットを作成」をクリック

### 4-3. CLIENT_ORIGIN を作成

Backend の CORS 設定に使います。

1. 「シークレットを作成」をクリック
2. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 名前 | `CLIENT_ORIGIN` |
| シークレットの値 | `https://example.com`（仮の値。後で更新） |

3. 「シークレットを作成」をクリック

### 4-4. BETTER_AUTH_SECRET を作成

認証用のシークレットキーです。

1. 「シークレットを作成」をクリック
2. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 名前 | `BETTER_AUTH_SECRET` |
| シークレットの値 | ランダムな文字列（下記参照） |

**ランダムな文字列の生成方法**:
- https://randomkeygen.com にアクセス
- 「CodeIgniter Encryption Keys」のどれかをコピー

3. 「シークレットを作成」をクリック

### 4-5. GOOGLE_CLIENT_ID を作成（仮の値）

Google OAuth のクライアント ID です。Step 8 で実際の値に更新します。

1. 「シークレットを作成」をクリック
2. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 名前 | `GOOGLE_CLIENT_ID` |
| シークレットの値 | `dummy`（仮の値。後で更新） |

3. 「シークレットを作成」をクリック

### 4-6. GOOGLE_CLIENT_SECRET を作成（仮の値）

Google OAuth のクライアントシークレットです。Step 8 で実際の値に更新します。

1. 「シークレットを作成」をクリック
2. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 名前 | `GOOGLE_CLIENT_SECRET` |
| シークレットの値 | `dummy`（仮の値。後で更新） |

3. 「シークレットを作成」をクリック

### 4-7. 作成したシークレットの確認

作成後、以下の 5 つのシークレットがあることを確認：

- `DATABASE_URL`
- `CLIENT_ORIGIN`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

## Step 5: Artifact Registry の設定

Artifact Registry は、Docker イメージを保存する場所です。

### 5-1. Artifact Registry を開く

1. 左メニュー →「CI/CD」→「Artifact Registry」
2. または検索バーで「Artifact Registry」と検索

### 5-2. リポジトリを作成

1. 「リポジトリを作成」をクリック
2. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 名前 | `cloud-run-repo` |
| 形式 | `Docker` |
| モード | `標準` |
| ロケーションタイプ | `リージョン` |
| リージョン | `asia-northeast1 (東京)` |

3. 「作成」をクリック

### 5-3. 作成の確認

リポジトリ一覧に `cloud-run-repo` が表示されていれば OK です。

### 5-4. クリーンアップポリシーの設定

古い Docker イメージが溜まると料金がかかるため、自動削除・保持ポリシーを設定します。

1. 作成した `cloud-run-repo` を選択し、「リポジトリの編集」をクリック
2. 「クリーンアップポリシー」セクションを探す

**削除ポリシーの作成**

3. 「アーティファクトを削除」を選択
4. 「ポリシーを追加」をクリック
5. 以下を設定：

| 項目 | 値 |
|-----|-----|
| 名前 | `delete-old-images` |
| ポリシータイプ | `条件付き削除` |
| タグの状態 | `タグの状態は問わない` |

**保持ポリシーの作成**

6. 「アーティファクトを保持」を選択
7. 「ポリシーを追加」をクリック
8. 以下を設定：

| 項目 | 値 |
|-----|-----|
| 名前 | `keep-latest` |
| ポリシーの種類 | `最新バージョンを保持` |
| 保持数 | `2` |

9. 「保存」をクリック

> **ポイント**: 削除ポリシーで古いイメージを自動削除し、保持ポリシーで最新 2 バージョンは常に保持されます。

---

## Step 6: Cloud Build トリガーの設定

Cloud Build トリガーは、GitHub への push を検知して自動でビルド・デプロイを実行します。

### 6-1. Cloud Build を開く

1. 左メニュー →「CI/CD」→「Cloud Build」
2. または検索バーで「Cloud Build」と検索
3. 左メニュー →「トリガー」をクリック

### 6-2. サービスアカウントに権限を付与

トリガーを作成する前に、Cloud Build で使用するサービスアカウントに必要な権限を付与します。

1. 左メニュー →「IAM と管理」→「IAM」
2. `xxxx-compute@developer.gserviceaccount.com` という行を探す
   - `xxxx` は数字のプロジェクト番号
3. その行の右端にある鉛筆アイコン（編集）をクリック
4. 「別のロールを追加」をクリックして、以下を追加：
   - `Cloud Run 管理者`
   - `サービス アカウント ユーザー`
   - `Secret Manager のシークレット アクセサー`
5. 「保存」をクリック

### 6-3. Secret Manager へのアクセス権限を付与

Cloud Run がシークレットを読み取れるように設定します。

1. 左メニュー →「セキュリティ」→「Secret Manager」
2. `DATABASE_URL` をクリック
3. 「権限」タブをクリック
4. 「アクセスを許可」をクリック
5. 以下を入力：

| 項目 | 値 |
|-----|-----|
| 新しいプリンシパル | `xxxx-compute@developer.gserviceaccount.com` |
| ロール | `Secret Manager のシークレット アクセサー` |

> **注意**: `xxxx` はプロジェクト番号です。「IAM と管理」→「設定」で確認できます。

6. 「保存」をクリック
7. 他のシークレット（`CLIENT_ORIGIN`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`）にも同様の権限を付与

### 6-4. Backend 用トリガーを作成

1. 「Cloud Build」→「トリガー」に戻る
2. 「トリガーを作成」をクリック
3. 以下を設定：

**基本設定**

| 項目 | 値 |
|-----|-----|
| 名前 | `backend-deploy` |
| リージョン | `グローバル` |

**リポジトリ**

4. 「リポジトリを接続」をクリック
5. 「ソースを選択」で「GitHub (Cloud Build GitHub アプリ)」を選択
6. 「続行」をクリック
7. GitHub の認証画面が表示されたら、アクセスを許可
8. 対象のリポジトリ（Fork した `immortal-architecture-deploy`）を選択
9. 「接続」をクリック
10. 接続したリポジトリを選択

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

**構成**

| 項目 | 値 |
|-----|-----|
| タイプ | `Cloud Build 構成ファイル（YAML または JSON）` |
| ロケーション | `リポジトリ` |
| Cloud Build 構成ファイルの場所 | `backend-clean/cloudbuild.yaml` |

**サービスアカウント**

| 項目 | 値 |
|-----|-----|
| サービス アカウント | `xxxx-compute@developer.gserviceaccount.com` |

> ⚠️ デフォルトの Compute Engine サービスアカウントが選択されます

11. 「作成」をクリック

### 6-5. Frontend 用トリガーを作成

1. 「トリガーを作成」をクリック
2. 以下を設定：

**基本設定**

| 項目 | 値 |
|-----|-----|
| 名前 | `frontend-deploy` |
| リージョン | `グローバル` |

**リポジトリ**

接続済みのリポジトリを選択

**イベント**

| 項目 | 値 |
|-----|-----|
| イベント | `ブランチに push する` |
| ブランチ | `^main$` |

**ソース - フィルタ**

「フィルタを追加」をクリックして：

| 項目 | 値 |
|-----|-----|
| 含まれるファイル フィルタ (glob) | `frontend/**` |

**構成**

| 項目 | 値 |
|-----|-----|
| タイプ | `Cloud Build 構成ファイル（YAML または JSON）` |
| ロケーション | `リポジトリ` |
| Cloud Build 構成ファイルの場所 | `frontend/cloudbuild.yaml` |

**代入変数**

「変数を追加」をクリックして、以下の 2 つを追加：

| 変数 | 値 |
|-----|-----|
| `_NEXT_PUBLIC_APP_URL` | `https://example.com`（仮の値。後で更新） |
| `_API_BASE_URL` | `https://example.com`（仮の値。後で更新） |

**サービスアカウント**

| 項目 | 値 |
|-----|-----|
| サービス アカウント | `xxxx-compute@developer.gserviceaccount.com` |

> ⚠️ デフォルトの Compute Engine サービスアカウントが選択されます

3. 「作成」をクリック

---

## Step 7: 初回デプロイ

### 7-1. Backend をデプロイ

1. 「Cloud Build」→「トリガー」を開く
2. `backend-deploy` の右側にある「実行」をクリック
3. ブランチは `main` を選択
4. 「トリガーを実行」をクリック

### 7-2. ビルドの確認

1. 「履歴」をクリック
2. 実行中のビルドをクリックして、ログを確認
3. 緑色のチェックマークが表示されれば成功

> **ビルドには 5〜10 分かかります。**

### 7-3. Backend の URL を確認

1. 左メニュー →「Cloud Run」
2. `backend` サービスをクリック
3. 上部に表示される URL をメモ

```
https://backend-xxxxx-an.a.run.app
```

### 7-4. Frontend をデプロイ

1. 「Cloud Build」→「トリガー」を開く
2. `frontend-deploy` の右側にある「実行」をクリック
3. ブランチは `main` を選択
4. 「トリガーを実行」をクリック

> **Frontend のビルドは 10〜15 分かかります。**

### 7-5. Frontend の URL を確認

1. 左メニュー →「Cloud Run」
2. `frontend` サービスをクリック
3. 上部に表示される URL をメモ

```
https://frontend-xxxxx-an.a.run.app
```

### 7-6. URL を更新

実際の URL がわかったので、設定を更新します。

**CLIENT_ORIGIN の更新**

1. 「Secret Manager」を開く
2. `CLIENT_ORIGIN` をクリック
3. 「新しいバージョン」をクリック
4. 「シークレットの値」に Frontend の URL を入力
5. 「新しいバージョンを追加」をクリック

**Cloud Build トリガーの更新**

1. 「Cloud Build」→「トリガー」を開く
2. `frontend-deploy` をクリック
3. 「代入変数」を以下のように更新：
   - `_NEXT_PUBLIC_APP_URL` → Frontend の URL
   - `_API_BASE_URL` → Backend の URL
4. 「保存」をクリック

---

## Step 8: Google OAuth の設定

Google ログインを有効にするための設定です。

### 8-1. Google Auth Platform の設定

1. 左メニュー →「API とサービス」→「OAuth 同意画面」
2. 「Google Auth Platform」の画面が表示されたら「開始」をクリック
3. 「ブランディング」で以下を入力：

| 項目 | 値 |
|-----|-----|
| アプリ名 | `immortal-architecture` |
| ユーザー サポートメール | 自分のメールアドレス |

4. 「次へ」をクリック
5. 「対象」で「外部」を選択して「次へ」
6. 「連絡先情報」でメールアドレスを入力して「次へ」
7. 「完了」をクリック

### 8-2. OAuth クライアント ID の作成

1. 左メニュー →「API とサービス」→「認証情報」
2. 「認証情報を作成」→「OAuth クライアント ID」
3. 以下を入力：

| 項目 | 値 |
|-----|-----|
| アプリケーションの種類 | `ウェブ アプリケーション` |
| 名前 | `immortal-architecture-frontend` |

**承認済みのリダイレクト URI**

「URI を追加」をクリックして：

```
https://frontend-xxxxx-an.a.run.app/api/auth/callback/google
```

> **注意**: `frontend-xxxxx-an.a.run.app` は Step 6 で確認した実際の URL に置き換えてください。

4. 「作成」をクリック
5. 表示される「クライアント ID」と「クライアント シークレット」をメモ

### 8-3. Secret Manager のシークレットを更新

Step 4 で作成した仮の値を、実際の値に更新します。

**GOOGLE_CLIENT_ID の更新**

1. 「Secret Manager」を開く
2. `GOOGLE_CLIENT_ID` をクリック
3. 「新しいバージョン」をクリック
4. 「シークレットの値」にメモしたクライアント ID を入力
5. 「新しいバージョンを追加」をクリック

**GOOGLE_CLIENT_SECRET の更新**

1. `GOOGLE_CLIENT_SECRET` をクリック
2. 「新しいバージョン」をクリック
3. 「シークレットの値」にメモしたクライアントシークレットを入力
4. 「新しいバージョンを追加」をクリック

### 8-4. Frontend を再デプロイ

新しいシークレットを反映するために、Frontend を再デプロイします。

1. 「Cloud Build」→「トリガー」を開く
2. `frontend-deploy` の「実行」をクリック
3. ビルド完了を待つ

---

## Step 9: 動作確認

### 9-1. Frontend にアクセス

1. ブラウザで Frontend の URL にアクセス
2. ページが表示されることを確認

### 9-2. Google ログインをテスト

1. 「ログイン」ボタンをクリック
2. Google アカウントでログイン
3. ログインが成功することを確認

### 9-3. 機能をテスト

- テンプレートの作成・一覧表示
- ノートの作成・一覧表示
- ノートの編集・削除

---

## トラブルシューティング

### ビルドが失敗する

**よくある原因**:

1. **権限不足**
   - Cloud Build サービスアカウントに必要なロールが付与されているか確認

2. **Secret Manager のアクセスエラー**
   - シークレットへのアクセス権限を確認

3. **Dockerfile のエラー**
   - ログを確認して、エラーメッセージを読む

### Cloud Run が起動しない

**よくある原因**:

1. **DATABASE_URL が間違っている**
   - Secret Manager の値を確認
   - `?sslmode=require` が含まれているか確認

2. **ポートの設定ミス**
   - Backend: 8080
   - Frontend: 3000

### OAuth ログインが失敗する

**よくある原因**:

1. **リダイレクト URI の設定ミス**
   - Google Cloud Console で承認済みの URI を確認
   - URL が完全に一致しているか確認（末尾のスラッシュなど）

2. **シークレットが設定されていない**
   - `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を確認

---

## 関連ドキュメント

- [アーキテクチャ概要](./architecture.md)
- [Backend デプロイガイド](../backend-clean/docs/09_cloud_run_deploy.md)
- [Frontend デプロイガイド](../frontend/docs/01_cloud_run_deploy.md)
