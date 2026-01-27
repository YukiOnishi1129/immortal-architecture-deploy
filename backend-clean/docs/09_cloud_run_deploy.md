# Cloud Run デプロイガイド

> **このドキュメントのゴール**
> Cloud Build トリガーを使って、Backend (Go API) を Cloud Run に自動デプロイする方法を理解する

---

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [事前準備](#事前準備)
3. [Neon データベースのセットアップ](#neon-データベースのセットアップ)
4. [Secret Manager の設定](#secret-manager-の設定)
5. [Artifact Registry の設定](#artifact-registry-の設定)
6. [Cloud Build トリガーの設定](#cloud-build-トリガーの設定)
7. [Dockerfile の解説](#dockerfile-の解説)
8. [cloudbuild.yaml の解説](#cloudbuildyaml-の解説)
9. [デプロイの実行](#デプロイの実行)
10. [トラブルシューティング](#トラブルシューティング)

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           デプロイフロー                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   GitHub                          GCP                                       │
│   ┌──────────────┐                                                         │
│   │  main branch │                                                         │
│   │    push      │                                                         │
│   └──────┬───────┘                                                         │
│          │                                                                  │
│          │  webhook                                                         │
│          ▼                                                                  │
│   ┌──────────────┐                                                         │
│   │ Cloud Build  │                                                         │
│   │   トリガー    │                                                         │
│   └──────┬───────┘                                                         │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐              │
│   │    Cloud     │     │   Artifact   │     │   Cloud Run  │              │
│   │    Build     │────▶│   Registry   │────▶│   (Backend)  │              │
│   │   (ビルド)   │     │  (イメージ)  │     │  (デプロイ)  │              │
│   └──────────────┘     └──────────────┘     └──────┬───────┘              │
│                                                     │                       │
│          ┌──────────────────────────────────────────┴───────┐              │
│          │                                                  │              │
│          ▼                                                  ▼              │
│   ┌──────────────┐                                  ┌──────────────┐       │
│   │    Secret    │                                  │     Neon     │       │
│   │   Manager    │                                  │  PostgreSQL  │       │
│   └──────────────┘                                  └──────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### デプロイの流れ

1. GitHub の main ブランチに push
2. Cloud Build トリガーが検知（webhook）
3. Cloud Build が `cloudbuild.yaml` に従ってビルド実行
4. Docker イメージを Artifact Registry にプッシュ
5. Cloud Run にデプロイ

### 使用するサービス

| サービス | 役割 |
|---------|------|
| **Cloud Build** | Docker イメージのビルド、デプロイ実行 |
| **Cloud Build トリガー** | GitHub の push を検知して自動実行 |
| **Artifact Registry** | Docker イメージの保存 |
| **Cloud Run** | コンテナのホスティング |
| **Secret Manager** | 機密情報（DATABASE_URL など）の管理 |
| **Neon** | サーバーレス PostgreSQL |

---

## 事前準備

### 1. 必要な GCP API を有効化

```bash
# プロジェクトID を設定
export PROJECT_ID=immortal-architecture-deploy

# 必要な API を有効化
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project=$PROJECT_ID
```

### 2. gcloud CLI の設定

```bash
# プロジェクトをデフォルトに設定
gcloud config set project $PROJECT_ID

# リージョンをデフォルトに設定
gcloud config set run/region asia-northeast1
```

---

## Neon データベースのセットアップ

### 1. Neon アカウント作成

1. [neon.tech](https://neon.tech) にアクセス
2. GitHub または Google アカウントでサインアップ

### 2. プロジェクト作成

1. Dashboard で「New Project」をクリック
2. 以下を設定：
   - **Name**: `immortal-architecture`
   - **Region**: `Asia Pacific (Singapore)` または近いリージョン
   - **PostgreSQL Version**: `15` または最新

### 3. 接続文字列の取得

1. Dashboard の「Connection Details」から接続文字列をコピー
2. 形式: `postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

> **注意**: `?sslmode=require` が必要です

---

## Secret Manager の設定

### 1. Secret Manager を開く

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. 左メニューから「セキュリティ」→「Secret Manager」を選択
3. または直接アクセス: https://console.cloud.google.com/security/secret-manager

### 2. シークレットの作成

#### DATABASE_URL の作成

1. 「シークレットを作成」をクリック
2. 以下を入力：
   - **名前**: `DATABASE_URL`
   - **シークレットの値**: Neon からコピーした接続文字列
     ```
     postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```
3. 「シークレットを作成」をクリック

#### CLIENT_ORIGIN の作成

1. 「シークレットを作成」をクリック
2. 以下を入力：
   - **名前**: `CLIENT_ORIGIN`
   - **シークレットの値**: Frontend の URL（初回は仮の値でOK）
     ```
     https://frontend-xxxxx.asia-northeast1.run.app
     ```
3. 「シークレットを作成」をクリック

### 3. Cloud Run からのアクセス権限

Cloud Run がシークレットを読み取れるように権限を設定します。

1. 作成したシークレット（例: `DATABASE_URL`）をクリック
2. 「権限」タブを選択
3. 「アクセス権を付与」をクリック
4. 以下を入力：
   - **新しいプリンシパル**: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
     - `PROJECT_NUMBER` は Google Cloud Console のダッシュボードで確認できます
   - **ロール**: 「Secret Manager のシークレット アクセサー」を選択
5. 「保存」をクリック
6. `CLIENT_ORIGIN` にも同様の権限を付与

> **Tips**: PROJECT_NUMBER の確認方法
> - Google Cloud Console のホーム画面
> - 「プロジェクト情報」カードに「プロジェクト番号」として表示されています

```bash
# コマンドで確認する場合
gcloud projects describe $PROJECT_ID --format='value(projectNumber)'
```

---

## Artifact Registry の設定

Docker イメージを保存するリポジトリを作成します。

### 1. Artifact Registry を開く

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. 左メニューから「CI/CD」→「Artifact Registry」を選択
3. または直接アクセス: https://console.cloud.google.com/artifacts

### 2. リポジトリの作成

1. 「リポジトリを作成」をクリック
2. 以下を入力：
   - **名前**: `cloud-run-repo`
   - **形式**: `Docker`
   - **モード**: `標準`
   - **ロケーションタイプ**: `リージョン`
   - **リージョン**: `asia-northeast1 (東京)`
3. 「作成」をクリック

### 3. 確認

作成後、リポジトリ一覧に `cloud-run-repo` が表示されていれば OK です。

> **リポジトリのパス**
> 作成後のイメージパスは以下の形式になります：
> ```
> asia-northeast1-docker.pkg.dev/PROJECT_ID/cloud-run-repo/IMAGE_NAME:TAG
> ```

---

## Cloud Build トリガーの設定

GitHub リポジトリへの push を検知して、自動的に Cloud Build を実行するトリガーを設定します。

### 1. GitHub リポジトリとの接続

まず、Cloud Build と GitHub リポジトリを接続します。

1. [Cloud Build](https://console.cloud.google.com/cloud-build/builds) を開く
2. 左メニューから「トリガー」を選択
3. 「リポジトリを接続」をクリック
4. **ソースを選択**: `GitHub (Cloud Build GitHub アプリ)` を選択
5. 「続行」をクリック
6. GitHub の認証画面が表示されたら、対象のリポジトリへのアクセスを許可
7. 接続するリポジトリを選択：
   - リポジトリ: `YukiOnishi1129/immortal-architecture-deploy`
8. 「接続」をクリック

### 2. Backend 用トリガーの作成

1. 「トリガーを作成」をクリック
2. 以下を設定：

#### 基本設定
| 項目 | 値 |
|-----|-----|
| **名前** | `backend-deploy` |
| **説明** | `Backend を Cloud Run にデプロイ` |
| **リージョン** | `asia-northeast1` |

#### イベント
| 項目 | 値 |
|-----|-----|
| **イベント** | `ブランチに push する` |
| **ソース** | 接続した GitHub リポジトリを選択 |
| **ブランチ** | `^main$`（正規表現） |

#### フィルタ（重要）
「含まれるファイルフィルタ」を設定して、backend-clean の変更時のみ実行されるようにします：

| 項目 | 値 |
|-----|-----|
| **含まれるファイルフィルタ** | `backend-clean/**` |

#### 構成
| 項目 | 値 |
|-----|-----|
| **タイプ** | `Cloud Build 構成ファイル（YAML または JSON）` |
| **ロケーション** | `リポジトリ` |
| **Cloud Build 構成ファイルの場所** | `backend-clean/cloudbuild.yaml` |

3. 「作成」をクリック

### 3. Cloud Build サービスアカウントの権限設定

Cloud Build がデプロイを実行するために、サービスアカウントに権限を付与します。

1. [IAM と管理] → [IAM](https://console.cloud.google.com/iam-admin/iam) を開く
2. `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` を探す
3. 鉛筆アイコン（編集）をクリック
4. 以下のロールを追加：
   - `Cloud Run 管理者`
   - `サービス アカウント ユーザー`
   - `Secret Manager のシークレット アクセサー`
5. 「保存」をクリック

> **Tips**: PROJECT_NUMBER は Google Cloud Console のホーム画面で確認できます

---

## Dockerfile の解説

### マルチステージビルドとは？

Docker のマルチステージビルドは、1つの Dockerfile 内で複数の `FROM` を使い、ビルド環境と実行環境を分離する手法です。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        マルチステージビルドの流れ                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Stage 1: builder                         Stage 2: runner                  │
│   ┌─────────────────────────┐             ┌─────────────────────────┐      │
│   │  golang:1.25-alpine     │             │  distroless (最小限)    │      │
│   │  ─────────────────────  │             │  ─────────────────────  │      │
│   │  - Go コンパイラ        │             │  - バイナリのみ         │      │
│   │  - ソースコード         │  ──────▶   │  - シェルなし           │      │
│   │  - 依存パッケージ       │   COPY     │  - 最小限のライブラリ   │      │
│   │  - ビルドツール         │             │                         │      │
│   │                         │             │                         │      │
│   │  サイズ: ~500MB         │             │  サイズ: ~20MB          │      │
│   └─────────────────────────┘             └─────────────────────────┘      │
│                                                                             │
│   ビルドに必要なものすべて                 実行に必要なものだけ              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### なぜマルチステージビルドを使うのか？

| 観点 | シングルステージ | マルチステージ |
|------|----------------|---------------|
| **イメージサイズ** | 大きい（500MB以上） | 小さい（20MB程度） |
| **セキュリティ** | 攻撃対象が多い | 最小限で安全 |
| **起動速度** | 遅い | 速い |
| **転送コスト** | 高い | 低い |

### Dockerfile の詳細

```dockerfile
# =============================================================================
# Stage 1: Build（ビルド環境）
# =============================================================================
FROM golang:1.25-alpine AS builder

# Alpine に必要なパッケージをインストール
RUN apk add --no-cache ca-certificates git

WORKDIR /app

# 依存関係を先にコピー（レイヤーキャッシュ最適化）
COPY go.mod go.sum ./
RUN go mod download

# ソースコードをコピー
COPY . .

# バイナリをビルド
# CGO_ENABLED=0: 静的バイナリ（C ライブラリに依存しない）
# -ldflags="-s -w": デバッグ情報を削除してサイズ縮小
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/api ./cmd/api

# =============================================================================
# Stage 2: Runtime（実行環境）
# =============================================================================
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

# ビルド済みバイナリをコピー（builder ステージから）
COPY --from=builder /app/bin/api /app/api

# Migration ファイルもコピー（Cloud Build での migration 用）
COPY --from=builder /app/migrations /app/migrations

# Cloud Run は PORT 環境変数を使用
ENV PORT=8080
EXPOSE 8080

# 非 root ユーザーで実行（セキュリティ）
USER nonroot:nonroot

ENTRYPOINT ["/app/api"]
```

### 各ステージの役割

#### Stage 1: builder

| 行 | 説明 |
|----|------|
| `FROM golang:1.25-alpine AS builder` | Go のビルド環境。`AS builder` で名前を付ける |
| `RUN apk add --no-cache ...` | 必要なツールをインストール |
| `COPY go.mod go.sum ./` | 依存定義ファイルを先にコピー（キャッシュ効率化） |
| `RUN go mod download` | 依存関係をダウンロード |
| `COPY . .` | ソースコードをコピー |
| `RUN CGO_ENABLED=0 ...` | 静的バイナリとしてビルド |

#### Stage 2: runner

| 行 | 説明 |
|----|------|
| `FROM gcr.io/distroless/static-debian12:nonroot` | 最小限の実行環境（シェルなし） |
| `COPY --from=builder ...` | builder ステージからバイナリをコピー |
| `USER nonroot:nonroot` | 非 root ユーザーで実行（セキュリティ） |
| `ENTRYPOINT ["/app/api"]` | コンテナ起動時に実行するコマンド |

### Distroless イメージとは？

Google が提供する、アプリケーション実行に必要最小限のファイルのみを含むイメージです。

```
通常の Alpine イメージ:
├── シェル (sh, bash)
├── パッケージマネージャ (apk)
├── 各種ユーティリティ (ls, cat, etc.)
└── アプリケーション

Distroless イメージ:
└── アプリケーション（とその依存ライブラリのみ）
```

**メリット**:
- シェルがないので、コンテナに侵入されても攻撃が困難
- 脆弱性のあるパッケージが含まれない
- イメージサイズが非常に小さい

**デメリット**:
- デバッグが難しい（シェルがないので `docker exec` で入れない）
- 開発時は通常のイメージを使うことが多い

---

## cloudbuild.yaml の解説

`backend-clean/cloudbuild.yaml` の内容を解説します。

```yaml
steps:
  # -------------------------------------------------------------------------
  # Step 1: Docker イメージをビルド
  # -------------------------------------------------------------------------
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/backend:${SHORT_SHA}'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/backend:latest'
      - '-f'
      - 'Dockerfile'
      - '.'
    dir: 'backend-clean'

  # -------------------------------------------------------------------------
  # Step 2: イメージを Artifact Registry にプッシュ
  # -------------------------------------------------------------------------
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/backend:${SHORT_SHA}'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/backend:latest'

  # -------------------------------------------------------------------------
  # Step 3: Cloud Run にデプロイ
  # -------------------------------------------------------------------------
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'backend'
      - '--image'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/backend:${SHORT_SHA}'
      - '--region'
      - 'asia-northeast1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '8080'
      - '--set-secrets'
      - 'DATABASE_URL=DATABASE_URL:latest,CLIENT_ORIGIN=CLIENT_ORIGIN:latest'
```

### 各ステップの説明

| Step | 説明 |
|------|------|
| **Step 1** | Dockerfile を使って Docker イメージをビルド |
| **Step 2** | ビルドしたイメージを Artifact Registry にプッシュ |
| **Step 3** | Artifact Registry のイメージを Cloud Run にデプロイ |

### ポイント

1. **タグ戦略**
   - `${SHORT_SHA}`: コミットハッシュ（どのコードからビルドされたか追跡可能）
   - `latest`: 最新バージョンを示すタグ

2. **Secret Manager 連携**
   - `--set-secrets` で Secret Manager のシークレットを環境変数として注入
   - 形式: `環境変数名=シークレット名:バージョン`

3. **自動で使える変数**
   - `${PROJECT_ID}`: GCP プロジェクト ID
   - `${SHORT_SHA}`: コミットの短縮ハッシュ（7文字）
   - `${COMMIT_SHA}`: コミットの完全ハッシュ

---

## デプロイの実行

### 初回デプロイ

1. すべての事前設定が完了していることを確認：
   - Neon データベースが作成済み
   - Secret Manager にシークレットが登録済み
   - Artifact Registry にリポジトリが作成済み
   - Cloud Build トリガーが設定済み
   - Cloud Build サービスアカウントに権限が付与済み

2. GitHub の main ブランチに push：
   ```bash
   git add .
   git commit -m "Add Cloud Run deployment"
   git push origin main
   ```

3. Cloud Build が自動で実行されます

### ビルドの確認

1. [Cloud Build](https://console.cloud.google.com/cloud-build/builds) を開く
2. 実行中または完了したビルドを確認
3. ログを確認してエラーがないかチェック

### デプロイの確認

```bash
# Cloud Run サービス一覧
gcloud run services list

# サービスの URL を取得
gcloud run services describe backend --region=asia-northeast1 --format='value(status.url)'

# ログを確認
gcloud run services logs read backend --region=asia-northeast1 --limit=50
```

### 手動でトリガーを実行

GCP コンソールからトリガーを手動で実行することもできます：

1. [Cloud Build トリガー](https://console.cloud.google.com/cloud-build/triggers) を開く
2. `backend-deploy` トリガーの「実行」をクリック
3. ブランチを選択（通常は `main`）
4. 「トリガーを実行」をクリック

---

## トラブルシューティング

### Q: Cloud Build が権限エラーで失敗する

Cloud Build サービスアカウントに権限が不足しています。

1. [IAM](https://console.cloud.google.com/iam-admin/iam) を開く
2. `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` を探す
3. 以下のロールを追加：
   - `Cloud Run 管理者`
   - `サービス アカウント ユーザー`
   - `Secret Manager のシークレット アクセサー`

### Q: Secret Manager のシークレットにアクセスできない

Cloud Run からシークレットにアクセスできない場合：

1. [Secret Manager](https://console.cloud.google.com/security/secret-manager) を開く
2. 該当のシークレットをクリック
3. 「権限」タブで `PROJECT_NUMBER-compute@developer.gserviceaccount.com` に「Secret Manager のシークレット アクセサー」ロールがあるか確認

### Q: Cloud Build トリガーが実行されない

1. [Cloud Build トリガー](https://console.cloud.google.com/cloud-build/triggers) を開く
2. トリガーの設定を確認：
   - リポジトリが正しく接続されているか
   - ブランチパターンが `^main$` になっているか
   - ファイルフィルタが `backend-clean/**` になっているか
3. GitHub リポジトリで Cloud Build アプリがインストールされているか確認

### Q: Cloud Run が起動しない

```bash
# ログを確認
gcloud run services logs read backend --region=asia-northeast1 --limit=100
```

**よくある原因**:
- `DATABASE_URL` が設定されていない
- ポートが 8080 になっていない（Cloud Run は `PORT` 環境変数を使う）
- メモリ不足（デフォルト 512Mi で足りない場合は増やす）
- Neon への接続エラー（`sslmode=require` が必要）

---

## 関連ドキュメント

- [08_ci_pipeline.md](./08_ci_pipeline.md) - CI パイプラインガイド
- [05_local_setup.md](./05_local_setup.md) - ローカル環境セットアップ
- [Frontend デプロイガイド](../../frontend/docs/01_cloud_run_deploy.md) - Frontend のデプロイ
