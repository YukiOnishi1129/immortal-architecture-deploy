# Frontend Cloud Run デプロイガイド

> **このドキュメントのゴール**
> Cloud Build トリガーを使って、Frontend (Next.js) を Cloud Run に自動デプロイする方法を理解する

---

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [Backend との違い](#backend-との違い)
3. [Secret Manager の設定](#secret-manager-の設定)
4. [Cloud Build トリガーの設定](#cloud-build-トリガーの設定)
5. [Dockerfile の解説](#dockerfile-の解説)
6. [cloudbuild.yaml の解説](#cloudbuildyaml-の解説)
7. [デプロイの実行](#デプロイの実行)
8. [トラブルシューティング](#トラブルシューティング)

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Frontend デプロイフロー                                 │
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
│   ┌──────────────┐     Build Args:                                         │
│   │ Cloud Build  │     - NEXT_PUBLIC_APP_URL                               │
│   │   トリガー    │                                                         │
│   └──────┬───────┘                                                         │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                         │
│   │   Cloud Run  │     Runtime Secrets:                                    │
│   │  (Frontend)  │     - DATABASE_URL                                      │
│   │              │     - BETTER_AUTH_SECRET                                │
│   │  Next.js     │     - GOOGLE_CLIENT_ID                                  │
│   │  standalone  │     - GOOGLE_CLIENT_SECRET                              │
│   └──────────────┘                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Backend との違い

| 項目 | Backend (Go) | Frontend (Next.js) |
|------|-------------|-------------------|
| **ベースイメージ** | distroless | node:22-alpine |
| **ビルド出力** | 単一バイナリ | standalone フォルダ |
| **ビルド時環境変数** | なし | `NEXT_PUBLIC_*` |
| **ランタイム** | なし | Node.js |
| **ポート** | 8080 | 3000 |
| **Migration ツール** | golang-migrate | Drizzle Kit |

### Next.js の特殊性

```
Next.js では環境変数の扱いが特殊:

1. NEXT_PUBLIC_* 変数
   - ビルド時に埋め込まれる
   - クライアントサイドで参照可能
   → Docker build 時に --build-arg で渡す必要あり

2. その他の環境変数
   - ランタイムで参照
   - サーバーサイドのみ
   → Secret Manager で Cloud Run に注入
```

---

## Secret Manager の設定

### 必要なシークレット一覧

Frontend では以下のシークレットが必要です：

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `DATABASE_URL` | Neon PostgreSQL 接続文字列 | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `BETTER_AUTH_SECRET` | Better Auth のシークレットキー | ランダムな32文字以上の文字列 |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | `GOCSPX-xxxxx` |

> **注意**: `DATABASE_URL` は Backend と共通で使用します。既に作成済みの場合は作成不要です。

### シークレットの作成手順

1. [Secret Manager](https://console.cloud.google.com/security/secret-manager) を開く
2. 「シークレットを作成」をクリック
3. 各シークレットを作成：

#### BETTER_AUTH_SECRET の作成

1. **名前**: `BETTER_AUTH_SECRET`
2. **シークレットの値**: ランダムな文字列を入力
   - 以下のコマンドで生成できます：
     ```bash
     openssl rand -base64 32
     ```
   - または [randomkeygen.com](https://randomkeygen.com/) などで生成
3. 「シークレットを作成」をクリック

#### GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET の作成

Google OAuth の認証情報を先に作成してから、シークレットを登録します。

---

### Google OAuth の設定

1. [Google Cloud Console の認証情報](https://console.cloud.google.com/apis/credentials) を開く
2. 「認証情報を作成」→「OAuth クライアント ID」をクリック
3. 以下を設定：
   - **アプリケーションの種類**: `ウェブ アプリケーション`
   - **名前**: `immortal-architecture-frontend`
   - **承認済みの JavaScript 生成元**: （空でOK）
   - **承認済みのリダイレクト URI**:
     ```
     https://frontend-xxxxx.asia-northeast1.run.app/api/auth/callback/google
     ```
     > **注意**: 初回デプロイ後に Cloud Run の URL がわかったら追加します
4. 「作成」をクリック
5. 表示される **クライアント ID** と **クライアント シークレット** をコピー
6. Secret Manager で `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を作成

---

### シークレットへの権限付与

各シークレットに対して、Cloud Run からのアクセス権限を付与します。

1. Secret Manager で作成したシークレットをクリック
2. 「権限」タブを選択
3. 「アクセス権を付与」をクリック
4. 以下を入力：
   - **新しいプリンシパル**: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
   - **ロール**: `Secret Manager のシークレット アクセサー`
5. 「保存」をクリック

> すべてのシークレット（`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`）に同様の権限を付与してください。

---

## Cloud Build トリガーの設定

GitHub リポジトリへの push を検知して、自動的に Cloud Build を実行するトリガーを設定します。

> **注意**: Backend で既に GitHub リポジトリとの接続が完了している場合は、手順1はスキップできます。

### 1. GitHub リポジトリとの接続（未設定の場合）

1. [Cloud Build](https://console.cloud.google.com/cloud-build/builds) を開く
2. 左メニューから「トリガー」を選択
3. 「リポジトリを接続」をクリック
4. GitHub の認証を行い、対象のリポジトリを接続

### 2. Frontend 用トリガーの作成

1. 「トリガーを作成」をクリック
2. 以下を設定：

#### 基本設定
| 項目 | 値 |
|-----|-----|
| **名前** | `frontend-deploy` |
| **説明** | `Frontend を Cloud Run にデプロイ` |
| **リージョン** | `asia-northeast1` |

#### イベント
| 項目 | 値 |
|-----|-----|
| **イベント** | `ブランチに push する` |
| **ソース** | 接続した GitHub リポジトリを選択 |
| **ブランチ** | `^main$`（正規表現） |

#### フィルタ（重要）
「含まれるファイルフィルタ」を設定して、frontend の変更時のみ実行されるようにします：

| 項目 | 値 |
|-----|-----|
| **含まれるファイルフィルタ** | `frontend/**` |

#### 構成
| 項目 | 値 |
|-----|-----|
| **タイプ** | `Cloud Build 構成ファイル（YAML または JSON）` |
| **ロケーション** | `リポジトリ` |
| **Cloud Build 構成ファイルの場所** | `frontend/cloudbuild.yaml` |

#### 代入変数（重要）
「代入変数」セクションで、ビルド時に使用する変数を設定します：

| 変数 | 値 |
|-----|-----|
| `_NEXT_PUBLIC_APP_URL` | `https://frontend-xxxxx.asia-northeast1.run.app`（後で更新） |

> **注意**: 初回デプロイ時は仮の URL を設定し、デプロイ後に実際の URL に更新します。

3. 「作成」をクリック

### 3. Cloud Build サービスアカウントの権限設定

> **注意**: Backend で既に設定済みの場合はスキップできます。

1. [IAM と管理] → [IAM](https://console.cloud.google.com/iam-admin/iam) を開く
2. `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` を探す
3. 以下のロールを追加：
   - `Cloud Run 管理者`
   - `サービス アカウント ユーザー`
   - `Secret Manager のシークレット アクセサー`
4. 「保存」をクリック

---

## Dockerfile の解説

```dockerfile
# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app

# pnpm を有効化
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依存関係をインストール（キャッシュ最適化）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Build
# =============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ビルド時に必要な環境変数（クライアントに埋め込まれる）
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Next.js をビルド
RUN pnpm build

# =============================================================================
# Stage 3: Runtime
# =============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 非 root ユーザー作成
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 出力をコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration 用ファイル
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/external/client/database ./src/external/client/database
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs

CMD ["node", "server.js"]
```

### ポイント

1. **3-stage Build**: deps → builder → runner で最適化
2. **standalone 出力**: `next.config.ts` の `output: "standalone"` により、必要なファイルのみ含むディレクトリが生成
3. **NEXT_PUBLIC_* の注入**: ビルド時に `--build-arg` で渡す
4. **pnpm 対応**: `corepack` で pnpm を有効化

---

## cloudbuild.yaml の解説

`frontend/cloudbuild.yaml` の内容を解説します。

```yaml
steps:
  # -------------------------------------------------------------------------
  # Step 1: Docker イメージをビルド（NEXT_PUBLIC_APP_URL を注入）
  # -------------------------------------------------------------------------
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/frontend:${SHORT_SHA}'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/frontend:latest'
      - '--build-arg'
      - 'NEXT_PUBLIC_APP_URL=${_NEXT_PUBLIC_APP_URL}'
      - '-f'
      - 'Dockerfile'
      - '.'
    dir: 'frontend'

  # -------------------------------------------------------------------------
  # Step 2: イメージを Artifact Registry にプッシュ
  # -------------------------------------------------------------------------
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/frontend:${SHORT_SHA}'

  # -------------------------------------------------------------------------
  # Step 3: Cloud Run にデプロイ
  # -------------------------------------------------------------------------
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'frontend'
      - '--image'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/frontend:${SHORT_SHA}'
      - '--region'
      - 'asia-northeast1'
      - '--set-secrets'
      - 'DATABASE_URL=DATABASE_URL:latest,BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest,...'
      - '--set-env-vars'
      - 'BETTER_AUTH_URL=${_NEXT_PUBLIC_APP_URL}'

substitutions:
  _NEXT_PUBLIC_APP_URL: 'https://frontend-xxxxx.asia-northeast1.run.app'
```

### 環境変数の渡し方まとめ

| 変数 | 用途 | タイミング | 方法 |
|-----|------|----------|------|
| `NEXT_PUBLIC_APP_URL` | クライアント側の API 呼び出し | ビルド時 | `--build-arg` |
| `BETTER_AUTH_URL` | サーバー側の OAuth コールバック URL | ランタイム | `--set-env-vars` |
| `DATABASE_URL` | DB 接続 | ランタイム | `--set-secrets` |
| `BETTER_AUTH_SECRET` | セッション署名 | ランタイム | `--set-secrets` |
| `GOOGLE_CLIENT_ID` | OAuth 認証 | ランタイム | `--set-secrets` |
| `GOOGLE_CLIENT_SECRET` | OAuth 認証 | ランタイム | `--set-secrets` |

> **ポイント**: `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、クライアントで使う変数にのみ使用。
> サーバーサイドで使う URL（OAuth コールバックなど）は `BETTER_AUTH_URL` で別に渡します。

### 代入変数（substitutions）

Cloud Build トリガーの設定で `_NEXT_PUBLIC_APP_URL` を設定します。
これにより、ビルド時に正しい URL が埋め込まれます。

---

## デプロイの実行

### 初回デプロイ

1. すべての事前設定が完了していることを確認：
   - Secret Manager にシークレットが登録済み
   - Cloud Build トリガーが設定済み（`_NEXT_PUBLIC_APP_URL` は仮の値でOK）
   - Cloud Build サービスアカウントに権限が付与済み

2. main ブランチに push：
   ```bash
   git add .
   git commit -m "Add Cloud Run deployment"
   git push origin main
   ```

3. Cloud Build が自動で実行されます

### URL の更新（初回デプロイ後）

初回デプロイ後、Cloud Run の URL がわかったら設定を更新します。

1. **Cloud Run の URL を確認**
   ```bash
   gcloud run services describe frontend --region=asia-northeast1 --format='value(status.url)'
   ```

2. **Cloud Build トリガーの代入変数を更新**
   - [Cloud Build トリガー](https://console.cloud.google.com/cloud-build/triggers) を開く
   - `frontend-deploy` トリガーを編集
   - 「代入変数」の `_NEXT_PUBLIC_APP_URL` を実際の URL に更新

3. **Google OAuth のリダイレクト URI を更新**
   - [認証情報](https://console.cloud.google.com/apis/credentials) を開く
   - OAuth クライアント ID を編集
   - 「承認済みのリダイレクト URI」に実際の URL を追加：
     ```
     https://frontend-xxxxx.asia-northeast1.run.app/api/auth/callback/google
     ```

4. **再デプロイ**
   - Cloud Build トリガーを手動で実行、または
   - コードを push して自動デプロイ

---

## トラブルシューティング

### Q: ビルドが失敗する（NEXT_PUBLIC_* がない）

Cloud Build トリガーの代入変数を確認してください：

1. [Cloud Build トリガー](https://console.cloud.google.com/cloud-build/triggers) を開く
2. `frontend-deploy` トリガーを編集
3. 「代入変数」に `_NEXT_PUBLIC_APP_URL` が設定されているか確認

### Q: OAuth リダイレクトエラー

1. Google Cloud Console でリダイレクト URI を確認
2. `BETTER_AUTH_URL` が Cloud Run の URL と一致しているか確認
3. Secret Manager の `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` を確認

### Q: データベース接続エラー

```bash
# Secret Manager の DATABASE_URL を確認
gcloud secrets versions access latest --secret=DATABASE_URL

# Neon のダッシュボードで接続を確認
# - IP 許可設定（Neon はデフォルトで全 IP 許可）
# - SSL 設定（?sslmode=require が必要）
```

### Q: 起動後すぐに停止する

```bash
# ログを確認
gcloud run services logs read frontend --region=asia-northeast1 --limit=100

# よくある原因:
# - HOSTNAME が 0.0.0.0 になっていない
# - PORT が 3000 になっていない
# - 必要な環境変数が設定されていない
```

---

## 関連ドキュメント

- [Backend デプロイガイド](../../backend-clean/docs/09_cloud_run_deploy.md)
- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/next-config-js/output)
- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations)
