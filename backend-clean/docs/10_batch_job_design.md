# ジョブ処理設計ガイド - Cloud Run Jobs + Cloud Scheduler

このドキュメントでは、Cloud Run Jobs を使った定期ジョブ処理の設計方針を解説します。

---

## 概要

### 実装するジョブ処理

**非アクティブユーザーの自動無効化**

- 最終ログインから90日以上経過したユーザーを `is_active = false` に更新
- 毎日深夜に実行（Cloud Scheduler でトリガー）

---

## アーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              GCP                                         │
│                                                                          │
│   ┌──────────────────┐         ┌──────────────────────────────────────┐ │
│   │  Cloud Scheduler │         │           Cloud Run Jobs              │ │
│   │                  │         │                                       │ │
│   │  毎日 03:00 JST  │────────▶│  deactivate-inactive-users           │ │
│   │                  │   HTTP  │                                       │ │
│   └──────────────────┘         │  ┌─────────────────────────────────┐ │ │
│                                │  │  backend-clean (job)            │ │ │
│                                │  │                                  │ │ │
│                                │  │  cmd/job/main.go                │ │ │
│                                │  │    ↓                            │ │ │
│                                │  │  Controller                     │ │ │
│                                │  │    ↓                            │ │ │
│                                │  │  UseCase (Interactor)           │ │ │
│                                │  │    ↓                            │ │ │
│                                │  │  Repository                     │ │ │
│                                │  │    ↓                            │ │ │
│                                │  │  Presenter                      │ │ │
│                                │  └─────────────────────────────────┘ │ │
│                                └──────────────────────────────────────┘ │
│                                            │                             │
│                                            │ SQL                         │
│                                            ↓                             │
│   ┌───────────────────────────────────────────────────────────────────┐ │
│   │                            Neon                                    │ │
│   │                     (PostgreSQL)                                   │ │
│   │                                                                    │ │
│   │  UPDATE accounts SET is_active = false                            │ │
│   │  WHERE last_login_at < NOW() - INTERVAL '90 days'                 │ │
│   │    AND is_active = true                                           │ │
│   └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cloud Run Service vs Cloud Run Jobs

| 項目 | Cloud Run Service | Cloud Run Jobs |
|------|-------------------|----------------|
| **用途** | HTTP API サーバー | ジョブ処理・定期実行 |
| **起動方式** | HTTP リクエストで起動 | ジョブ実行で起動 |
| **終了条件** | 常時起動（リクエスト待機） | 処理完了で終了 |
| **課金** | リクエスト処理時間 | 実行時間のみ |
| **今回の用途** | API サーバー（既存） | ジョブ処理（新規） |

---

## ディレクトリ構成

```
backend-clean/
├── cmd/
│   ├── api/
│   │   └── main.go              # HTTP API サーバー（既存）
│   ├── grpc/
│   │   └── main.go              # gRPC サーバー（既存）
│   └── job/                     # 🆕 ジョブ処理
│       └── main.go              # ジョブ用エントリーポイント
│
├── internal/
│   ├── domain/
│   │   └── account/
│   │       └── entity.go        # Account エンティティ（既存）
│   │
│   ├── usecase/
│   │   ├── account_interactor.go       # 既存の UseCase
│   │   └── deactivate_job_interactor.go  # 🆕 ジョブ専用 UseCase
│   │
│   ├── port/
│   │   ├── account_port.go             # 既存の Repository インターフェース
│   │   │                               # DeactivateByLastLoginBefore メソッド追加
│   │   └── deactivate_job_port.go      # 🆕 ジョブ専用 InputPort/OutputPort
│   │
│   ├── adapter/
│   │   ├── gateway/
│   │   │   └── db/
│   │   │       └── sqlc/
│   │   │           └── account_repository.go  # DeactivateByLastLoginBefore 実装
│   │   │
│   │   └── job/                        # 🆕 ジョブ専用 Adapter
│   │       ├── controller/
│   │       │   └── deactivate_controller.go
│   │       └── presenter/
│   │           └── deactivate_presenter.go
│   │
│   └── driver/
│       ├── factory/
│       │   ├── usecase_factory.go      # NewDeactivateJobInputFactory 追加
│       │   └── job/                    # 🆕 ジョブ専用 Factory
│       │       └── presenter_factory.go
│       │
│       └── initializer/
│           ├── api/
│           │   └── initializer.go      # HTTP API 初期化（既存）
│           └── job/                    # 🆕 ジョブ初期化
│               └── initializer.go
│
├── Dockerfile                   # API 用（既存）
└── Dockerfile.job               # 🆕 ジョブ用
```

---

## クリーンアーキテクチャでの設計

### レイヤー構成

```
┌─────────────────────────────────────────────────────────────────┐
│                       cmd/job/main.go                            │
│  - コマンドライン引数の解析                                        │
│  - Initializer の呼び出し                                         │
│  - 終了コードの制御                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              driver/initializer/job/initializer.go               │
│  - DB接続                                                         │
│  - Factory を使った依存性注入                                      │
│  - Controller の生成と実行                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          adapter/job/controller/deactivate_controller.go         │
│                                                                   │
│  type DeactivateController struct {                               │
│      inputFactory  func(...) port.DeactivateJobInputPort          │
│      outputFactory func() *presenter.DeactivatePresenter          │
│      repoFactory   func() port.AccountRepository                  │
│  }                                                                │
│                                                                   │
│  func (c *DeactivateController) Run(ctx) (int, error) {          │
│      // 1. Factory から Presenter, Repository, UseCase を生成     │
│      // 2. UseCase.Execute() を呼び出し                            │
│      // 3. Presenter から結果を取得して返す                         │
│  }                                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               usecase/deactivate_job_interactor.go               │
│                                                                   │
│  type DeactivateInteractor struct {                               │
│      repo   port.AccountRepository                                │
│      output port.DeactivateJobOutputPort                          │
│  }                                                                │
│                                                                   │
│  func (u *DeactivateInteractor) Execute(ctx) error {             │
│      // 1. 90日前の日付を計算                                      │
│      // 2. Repository で無効化を実行                               │
│      // 3. OutputPort (Presenter) に結果を渡す                     │
│  }                                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     port/deactivate_job_port.go │   │     port/account_port.go      │
│                               │   │                               │
│  type DeactivateJobInputPort  │   │  type AccountRepository       │
│  interface {                  │   │  interface {                  │
│      Execute(ctx) error       │   │      ...                      │
│  }                            │   │      DeactivateByLastLoginBefore│
│                               │   │          (ctx, before) (int, error)│
│  type DeactivateJobOutputPort │   │  }                            │
│  interface {                  │   │                               │
│      PresentResult(ctx, count)│   │                               │
│  }                            │   │                               │
└───────────────────────────────┘   └───────────────────────────────┘
                                                    │
                                                    ↓
                              ┌─────────────────────────────────────────┐
                              │    adapter/gateway/db/sqlc/             │
                              │         account_repository.go           │
                              │                                         │
                              │  func (r *AccountRepository)            │
                              │  DeactivateByLastLoginBefore(           │
                              │      ctx, before time.Time,             │
                              │  ) (int, error) {                       │
                              │      // UPDATE accounts                 │
                              │      // SET is_active = false           │
                              │      // WHERE last_login_at < $1        │
                              │      //   AND is_active = true          │
                              │  }                                      │
                              └─────────────────────────────────────────┘

                              ↑
                              │ 結果
                              ↓

┌─────────────────────────────────────────────────────────────────┐
│          adapter/job/presenter/deactivate_presenter.go           │
│                                                                   │
│  type DeactivatePresenter struct {                                │
│      updatedCount int                                             │
│  }                                                                │
│                                                                   │
│  func (p *DeactivatePresenter) PresentResult(ctx, count) error { │
│      p.updatedCount = count                                       │
│      log.Printf("deactivated %d users", count)                   │
│  }                                                                │
│                                                                   │
│  func (p *DeactivatePresenter) UpdatedCount() int {              │
│      return p.updatedCount                                        │
│  }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### HTTP/gRPC との構造比較

| レイヤー | HTTP API | gRPC | Job |
|---------|----------|------|-----|
| エントリーポイント | cmd/api/main.go | cmd/grpc/main.go | cmd/job/main.go |
| Initializer | initializer/api/ | initializer/grpc/ | initializer/job/ |
| Controller | adapter/api/controller/ | adapter/grpc/controller/ | adapter/job/controller/ |
| Presenter | adapter/api/presenter/ | adapter/grpc/presenter/ | adapter/job/presenter/ |
| UseCase | usecase/*.go | usecase/*.go | usecase/*.go |
| Repository | adapter/gateway/db/ | adapter/gateway/db/ | adapter/gateway/db/ |

---

## 冪等性の担保

### 冪等性とは？

> 同じ操作を何度実行しても、結果が同じになる性質

### このジョブ処理での冪等性

```sql
-- このクエリは冪等
UPDATE accounts
SET is_active = false, updated_at = NOW()
WHERE last_login_at < $1  -- 90日前の日付
  AND is_active = true;   -- ← この条件がポイント
```

| 実行回数 | 対象ユーザー | 結果 |
|---------|-------------|------|
| 1回目 | 100件 | 100件を `is_active = false` に更新 |
| 2回目 | 0件 | 既に `is_active = false` なので対象外 |
| 3回目 | 0件 | 同上 |

**ポイント: `AND is_active = true` の条件により、既に無効化済みのユーザーは対象外となる**

### 冪等性が重要な理由

```
❌ 冪等性がない場合:
- ネットワークエラーでリトライ → 二重処理
- Cloud Scheduler の重複実行 → 予期せぬ状態

✅ 冪等性がある場合:
- 何度実行しても同じ結果
- 安心してリトライできる
- 運用が楽
```

---

## エラーハンドリングとリトライ

### Cloud Run Jobs のリトライ設定

```yaml
# Cloud Run Jobs の設定
maxRetries: 3
timeout: 300s  # 5分
```

### エラーパターンと対応

| エラー | 対応 | リトライ |
|-------|------|---------|
| DB接続エラー | ログ出力 + 終了コード1 | する |
| SQLエラー | ログ出力 + 終了コード1 | する |
| タイムアウト | ログ出力 + 終了コード1 | する |
| 0件更新 | 正常終了（終了コード0） | しない |

### 終了コードの設計

```go
const (
    ExitCodeSuccess = 0  // 正常終了
    ExitCodeError   = 1  // エラー終了（リトライ対象）
)
```

---

## 実装例

### cmd/job/main.go

```go
package main

import (
    "context"
    "log"
    "os"

    initializer "immortal-architecture-clean/backend/internal/driver/initializer/job"
)

func main() {
    ctx := context.Background()

    count, err := initializer.RunDeactivateInactiveUsers(ctx)
    if err != nil {
        log.Printf("job failed: %v", err)
        os.Exit(1)
    }

    log.Printf("job completed: %d users deactivated", count)
    os.Exit(0)
}
```

### driver/initializer/job/initializer.go

```go
package job

import (
    "context"
    "errors"
    "os"

    jobctrl "immortal-architecture-clean/backend/internal/adapter/job/controller"
    driverdb "immortal-architecture-clean/backend/internal/driver/db"
    "immortal-architecture-clean/backend/internal/driver/factory"
    jobfactory "immortal-architecture-clean/backend/internal/driver/factory/job"
)

func RunDeactivateInactiveUsers(ctx context.Context) (int, error) {
    dbURL := os.Getenv("DATABASE_URL")
    if dbURL == "" {
        return 0, errors.New("DATABASE_URL is not set")
    }

    pool, err := driverdb.NewPool(ctx, dbURL)
    if err != nil {
        return 0, err
    }
    defer pool.Close()

    // Factory パターンで依存性を注入
    accountRepoFactory := factory.NewAccountRepoFactory(pool)
    deactivateInputFactory := factory.NewDeactivateJobInputFactory()
    deactivateOutputFactory := jobfactory.NewDeactivateOutputFactory()

    controller := jobctrl.NewDeactivateController(
        deactivateInputFactory,
        deactivateOutputFactory,
        accountRepoFactory,
    )

    return controller.Run(ctx)
}
```

### adapter/job/controller/deactivate_controller.go

```go
package controller

import (
    "context"
    "log"

    "immortal-architecture-clean/backend/internal/adapter/job/presenter"
    "immortal-architecture-clean/backend/internal/port"
)

type DeactivateController struct {
    inputFactory  func(repo port.AccountRepository, output port.DeactivateJobOutputPort) port.DeactivateJobInputPort
    outputFactory func() *presenter.DeactivatePresenter
    repoFactory   func() port.AccountRepository
}

func NewDeactivateController(
    inputFactory func(repo port.AccountRepository, output port.DeactivateJobOutputPort) port.DeactivateJobInputPort,
    outputFactory func() *presenter.DeactivatePresenter,
    repoFactory func() port.AccountRepository,
) *DeactivateController {
    return &DeactivateController{
        inputFactory:  inputFactory,
        outputFactory: outputFactory,
        repoFactory:   repoFactory,
    }
}

func (c *DeactivateController) Run(ctx context.Context) (int, error) {
    log.Println("starting deactivation job for users inactive > 90 days")

    // Factory から各コンポーネントを生成
    p := c.outputFactory()
    repo := c.repoFactory()
    interactor := c.inputFactory(repo, p)

    // UseCase を実行
    if err := interactor.Execute(ctx); err != nil {
        return 0, err
    }

    return p.UpdatedCount(), nil
}
```

### usecase/deactivate_job_interactor.go

```go
package usecase

import (
    "context"
    "time"

    "immortal-architecture-clean/backend/internal/port"
)

const defaultInactiveDays = 90

type DeactivateInteractor struct {
    repo   port.AccountRepository
    output port.DeactivateJobOutputPort
}

// インターフェースの実装を保証
var _ port.DeactivateJobInputPort = (*DeactivateInteractor)(nil)

func NewDeactivateInteractor(
    repo port.AccountRepository,
    output port.DeactivateJobOutputPort,
) *DeactivateInteractor {
    return &DeactivateInteractor{repo: repo, output: output}
}

func (u *DeactivateInteractor) Execute(ctx context.Context) error {
    // 90日前の日付を計算
    before := time.Now().AddDate(0, 0, -defaultInactiveDays)

    // Repository で無効化を実行
    count, err := u.repo.DeactivateByLastLoginBefore(ctx, before)
    if err != nil {
        return err
    }

    // OutputPort (Presenter) に結果を渡す
    return u.output.PresentResult(ctx, count)
}
```

### port/deactivate_job_port.go

```go
package port

import "context"

// DeactivateJobInputPort はジョブ処理の入力ポート
type DeactivateJobInputPort interface {
    Execute(ctx context.Context) error
}

// DeactivateJobOutputPort はジョブ処理の出力ポート
type DeactivateJobOutputPort interface {
    PresentResult(ctx context.Context, updatedCount int) error
}
```

### adapter/job/presenter/deactivate_presenter.go

```go
package presenter

import (
    "context"
    "log"

    "immortal-architecture-clean/backend/internal/port"
)

type DeactivatePresenter struct {
    updatedCount int
}

// インターフェースの実装を保証
var _ port.DeactivateJobOutputPort = (*DeactivatePresenter)(nil)

func NewDeactivatePresenter() *DeactivatePresenter {
    return &DeactivatePresenter{}
}

func (p *DeactivatePresenter) PresentResult(_ context.Context, updatedCount int) error {
    p.updatedCount = updatedCount
    log.Printf("deactivated %d users", updatedCount)
    return nil
}

func (p *DeactivatePresenter) UpdatedCount() int {
    return p.updatedCount
}
```

### adapter/gateway/db/sqlc/account_repository.go（追加メソッド）

```go
func (r *AccountRepository) DeactivateByLastLoginBefore(
    ctx context.Context,
    before time.Time,
) (int, error) {
    query := `
        UPDATE accounts
        SET is_active = false, updated_at = NOW()
        WHERE last_login_at < $1
          AND is_active = true
    `

    result, err := r.pool.Exec(ctx, query, before)
    if err != nil {
        return 0, err
    }

    return int(result.RowsAffected()), nil
}
```

---

## テスト戦略

### Unit Test（UseCase層）

```go
func TestDeactivateInteractor_Execute(t *testing.T) {
    tests := []struct {
        name       string
        mockReturn int
        mockErr    error
        wantErr    bool
    }{
        {
            name:       "正常系: 10件更新",
            mockReturn: 10,
            mockErr:    nil,
            wantErr:    false,
        },
        {
            name:       "正常系: 0件更新（対象なし）",
            mockReturn: 0,
            mockErr:    nil,
            wantErr:    false,
        },
        {
            name:       "異常系: DBエラー",
            mockReturn: 0,
            mockErr:    errors.New("db error"),
            wantErr:    true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctrl := gomock.NewController(t)
            defer ctrl.Finish()

            mockRepo := mockusecase.NewMockAccountRepository(ctrl)
            mockOutput := mockusecase.NewMockDeactivateJobOutputPort(ctrl)

            // 90日前の日付でマッチング
            mockRepo.EXPECT().
                DeactivateByLastLoginBefore(gomock.Any(), gomock.Any()).
                Return(tt.mockReturn, tt.mockErr)

            if tt.mockErr == nil {
                mockOutput.EXPECT().
                    PresentResult(gomock.Any(), tt.mockReturn).
                    Return(nil)
            }

            interactor := usecase.NewDeactivateInteractor(mockRepo, mockOutput)
            err := interactor.Execute(context.Background())

            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### Integration Test（Repository層）

```go
func TestAccountRepository_DeactivateByLastLoginBefore(t *testing.T) {
    ctx := context.Background()
    pool := setupTestDB(t)  // testcontainers-go
    repo := sqlc.NewAccountRepository(pool)

    // テストデータ準備
    // - 91日前にログイン（is_active = true）→ 無効化対象
    // - 89日前にログイン（is_active = true）→ 対象外
    // - 91日前にログイン（is_active = false）→ 既に無効化済み
    setupTestAccounts(t, pool)

    // 実行（90日前の日付を指定）
    before := time.Now().AddDate(0, 0, -90)
    count, err := repo.DeactivateByLastLoginBefore(ctx, before)

    // 検証
    assert.NoError(t, err)
    assert.Equal(t, 1, count)  // 91日前の active ユーザーのみ

    // 冪等性の検証（2回目実行）
    count2, err := repo.DeactivateByLastLoginBefore(ctx, before)
    assert.NoError(t, err)
    assert.Equal(t, 0, count2)  // 対象なし
}
```

---

## デプロイ構成

### Dockerfile.job

```dockerfile
# =============================================================================
# Job Dockerfile for Cloud Run Jobs
# =============================================================================

FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /job ./cmd/job

# -----------------------------------------------------------------------------
# Runtime
# -----------------------------------------------------------------------------
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /job .

# ジョブはコマンドとして実行
ENTRYPOINT ["/app/job"]
```

### cloudbuild-job.yaml

```yaml
steps:
  # Step 1: Docker イメージをビルド
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/job:${SHORT_SHA}'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/job:latest'
      - '-f'
      - 'Dockerfile.job'
      - '.'
    dir: 'backend-clean'

  # Step 2: イメージをプッシュ
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/job:${SHORT_SHA}'

  # Step 3: Cloud Run Jobs にデプロイ
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'jobs'
      - 'deploy'
      - 'deactivate-inactive-users'
      - '--image'
      - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/job:${SHORT_SHA}'
      - '--region'
      - 'asia-northeast1'
      - '--set-secrets'
      - 'DATABASE_URL=DATABASE_URL:latest'
      - '--max-retries'
      - '3'
      - '--task-timeout'
      - '300s'

images:
  - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/job:${SHORT_SHA}'
  - 'asia-northeast1-docker.pkg.dev/${PROJECT_ID}/cloud-run-repo/job:latest'

timeout: '600s'

options:
  logging: CLOUD_LOGGING_ONLY
```

---

## Cloud Scheduler の設定

### スケジュール設定

| 項目 | 値 |
|------|-----|
| 名前 | `deactivate-inactive-users-scheduler` |
| リージョン | `asia-northeast1` |
| スケジュール | `0 3 * * *`（毎日03:00 JST） |
| タイムゾーン | `Asia/Tokyo` |
| ターゲット | Cloud Run Jobs |
| ジョブ名 | `deactivate-inactive-users` |

### なぜ深夜03:00？

- ユーザーアクセスが最も少ない時間帯
- DB負荷を避ける
- エラー時のリカバリ時間を確保

---

## 監視とアラート

### Cloud Logging

```
# ジョブ実行ログの検索
resource.type="cloud_run_job"
resource.labels.job_name="deactivate-inactive-users"
```

### アラート設定

| 条件 | アクション |
|------|----------|
| ジョブ失敗 | Slack 通知 |
| 実行時間 > 5分 | Slack 通知 |
| 更新件数 > 1000 | ログ確認（異常に多い場合） |

---

## 実装チェックリスト

### 開発フェーズ

- [x] `cmd/job/main.go` を作成
- [x] `usecase/deactivate_job_interactor.go` を作成
- [x] `port/deactivate_job_port.go` を作成
- [x] `port/account_port.go` に `DeactivateByLastLoginBefore` を追加
- [x] `adapter/gateway/db/sqlc/account_repository.go` に実装を追加
- [x] `adapter/job/controller/deactivate_controller.go` を作成
- [x] `adapter/job/presenter/deactivate_presenter.go` を作成
- [x] `driver/factory/usecase_factory.go` に Factory を追加
- [x] `driver/factory/job/presenter_factory.go` を作成
- [x] `driver/initializer/job/initializer.go` を作成
- [x] Unit Test を作成
- [x] Integration Test を作成
- [x] ローカルで動作確認

### デプロイフェーズ

- [x] `Dockerfile.job` を作成
- [x] `cloudbuild-job.yaml` を作成
- [ ] Cloud Build トリガーを作成
- [ ] Cloud Run Jobs にデプロイ
- [ ] Cloud Scheduler を設定
- [ ] 本番環境で動作確認

### 運用フェーズ

- [ ] Cloud Logging でログ確認
- [ ] アラート設定
- [ ] 運用ドキュメント作成

---

## 関連ドキュメント

- [02_clean_architecture_guide.md](./02_clean_architecture_guide.md) - クリーンアーキテクチャの基本
- [06_testing_strategy.md](./06_testing_strategy.md) - テスト戦略
- [09_cloud_run_deploy.md](./09_cloud_run_deploy.md) - Cloud Run デプロイガイド
