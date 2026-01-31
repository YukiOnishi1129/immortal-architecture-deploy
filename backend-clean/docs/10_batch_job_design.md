# ジョブ処理の実装ガイド

このドキュメントでは、このプロジェクトで実装したバッチ処理（Cloud Run Jobs）の詳細を解説します。

> **前提知識**: [バッチ処理入門](./11_batch_processing_guide.md) を先に読んでください

---

## 作ったもの

### 非アクティブユーザーの自動無効化

```
やること:
- 90日以上ログインしていないユーザーを見つける
- そのユーザーの is_active を false にする

いつ動かす:
- 毎日深夜（Cloud Scheduler で設定）
- または手動で実行
```

### なぜこの機能が必要？

```
セキュリティ:
- 長期間使っていないアカウントは乗っ取りリスクが高い
- 無効化しておけば、万が一パスワードが漏れても被害を防げる

データ管理:
- アクティブなユーザーだけを対象にした処理が速くなる
- 例: メール配信の対象を絞れる
```

---

## 全体の流れ

### 処理の流れ

```
1. ジョブが起動
   ↓
2. データベースに接続
   ↓
3. 「90日以上ログインしていない & まだ有効なユーザー」を検索
   ↓
4. 該当ユーザーの is_active を false に更新
   ↓
5. 更新した件数をログに出力
   ↓
6. ジョブ終了
```

### 実行結果の例

```
# 1回目の実行
[2024-01-15 03:00:00] starting deactivation job for users inactive > 90 days
[2024-01-15 03:00:01] deactivated 150 users
[2024-01-15 03:00:01] job completed: 150 users deactivated

# 2回目の実行（同じ日に再実行した場合）
[2024-01-15 03:05:00] starting deactivation job for users inactive > 90 days
[2024-01-15 03:05:00] deactivated 0 users
[2024-01-15 03:05:00] job completed: 0 users deactivated

→ 2回目は0件。冪等性が保たれている。
```

---

## ファイル構成

```
backend-clean/
├── cmd/
│   └── job/
│       └── main.go              ← エントリーポイント
│
├── internal/
│   ├── usecase/
│   │   └── deactivate_job_interactor.go  ← ビジネスロジック
│   │
│   ├── port/
│   │   └── deactivate_job_port.go        ← インターフェース定義
│   │
│   ├── adapter/
│   │   ├── gateway/db/sqlc/
│   │   │   └── account_repository.go     ← DB操作（既存ファイルに追加）
│   │   │
│   │   └── job/
│   │       ├── controller/
│   │       │   └── deactivate_controller.go  ← 処理の制御
│   │       └── presenter/
│   │           └── deactivate_presenter.go   ← 結果の出力
│   │
│   └── driver/
│       ├── factory/
│       │   └── job/
│       │       └── presenter_factory.go
│       │
│       └── initializer/
│           └── job/
│               └── initializer.go        ← 起動処理
│
├── Dockerfile.job               ← ジョブ用のDockerfile
└── cloudbuild-job.yaml          ← デプロイ設定
```

### なぜこんなに分かれている？

クリーンアーキテクチャのルールに従っているからです。

```
分け方の理由:

main.go
└─ 「アプリを起動する」だけ

initializer.go
└─ 「必要な部品を組み立てる」だけ

controller.go
└─ 「処理の流れを制御する」だけ

interactor.go
└─ 「ビジネスロジック」だけ

repository.go
└─ 「DBとやり取りする」だけ

presenter.go
└─ 「結果を出力する」だけ
```

それぞれが1つの責任だけを持つので、テストしやすく、変更しやすい。

---

## コードの解説

### 1. エントリーポイント（main.go）

一番最初に実行されるファイル。やることはシンプル。

```go
// cmd/job/main.go
package main

import (
    "context"
    "log"
    "os"

    initializer "immortal-architecture-clean/backend/internal/driver/initializer/job"
)

func main() {
    ctx := context.Background()

    // ジョブを実行
    count, err := initializer.RunDeactivateInactiveUsers(ctx)

    // 結果に応じて終了
    if err != nil {
        log.Printf("job failed: %v", err)
        os.Exit(1)  // 失敗 → Cloud Run Jobs がリトライ
    }

    log.Printf("job completed: %d users deactivated", count)
    os.Exit(0)  // 成功
}
```

**ポイント:**
- `os.Exit(1)` で終了すると、Cloud Run Jobs は「失敗」と判断してリトライする
- `os.Exit(0)` で終了すると、Cloud Run Jobs は「成功」と判断して終了する

### 2. 初期化（initializer.go）

必要な部品を組み立てて、処理を開始する。

```go
// driver/initializer/job/initializer.go
package job

func RunDeactivateInactiveUsers(ctx context.Context) (int, error) {
    // 1. 環境変数からDB接続情報を取得
    dbURL := os.Getenv("DATABASE_URL")
    if dbURL == "" {
        return 0, errors.New("DATABASE_URL is not set")
    }

    // 2. DBに接続
    pool, err := driverdb.NewPool(ctx, dbURL)
    if err != nil {
        return 0, err
    }
    defer pool.Close()  // 処理が終わったら接続を閉じる

    // 3. 必要な部品を作る（Factory パターン）
    accountRepoFactory := factory.NewAccountRepoFactory(pool)
    deactivateInputFactory := factory.NewDeactivateJobInputFactory()
    deactivateOutputFactory := jobfactory.NewDeactivateOutputFactory()

    // 4. Controller を作って実行
    controller := jobctrl.NewDeactivateController(
        deactivateInputFactory,
        deactivateOutputFactory,
        accountRepoFactory,
    )

    return controller.Run(ctx)
}
```

**ポイント:**
- `defer pool.Close()` で、処理が終わったら必ずDB接続を閉じる
- Factory パターンで部品を作ることで、テスト時にモックに差し替えられる

### 3. ビジネスロジック（interactor.go）

「90日前の日付を計算して、それより前にログインした人を無効化」

```go
// usecase/deactivate_job_interactor.go
package usecase

const defaultInactiveDays = 90

type DeactivateInteractor struct {
    repo   port.AccountRepository   // DB操作
    output port.DeactivateJobOutputPort  // 結果出力
}

func (u *DeactivateInteractor) Execute(ctx context.Context) error {
    // 1. 90日前の日付を計算
    before := time.Now().AddDate(0, 0, -defaultInactiveDays)
    // 例: 今日が 2024-04-15 なら、before は 2024-01-15

    // 2. DBで更新を実行
    count, err := u.repo.DeactivateByLastLoginBefore(ctx, before)
    if err != nil {
        return err
    }

    // 3. 結果を出力
    return u.output.PresentResult(ctx, count)
}
```

**ポイント:**
- `time.Now().AddDate(0, 0, -90)` で90日前の日付を取得
- ビジネスロジック（「90日」という数字）はここに書く
- DB操作の詳細（SQLなど）はここには書かない

### 4. DB操作（repository.go）

実際にSQLを実行する部分。

```go
// adapter/gateway/db/sqlc/account_repository.go

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

**ポイント:**
- `AND is_active = true` が冪等性を保証している
  - 既に無効化されたユーザーは対象外になる
  - 何回実行しても、同じユーザーが2回無効化されることはない
- `result.RowsAffected()` で更新した件数がわかる

### 5. 結果の出力（presenter.go）

処理結果をログに出力する。

```go
// adapter/job/presenter/deactivate_presenter.go

type DeactivatePresenter struct {
    updatedCount int
}

func (p *DeactivatePresenter) PresentResult(_ context.Context, updatedCount int) error {
    p.updatedCount = updatedCount
    log.Printf("deactivated %d users", updatedCount)
    return nil
}
```

**ポイント:**
- 今はログ出力だけ
- 将来、Slack通知やメトリクス送信を追加したくなったら、ここに追加する

---

## 冪等性の仕組み

### なぜ冪等？

SQLの条件に `AND is_active = true` があるから。

```sql
UPDATE accounts
SET is_active = false
WHERE last_login_at < '2024-01-15'
  AND is_active = true  ← これがポイント
```

### 動作の流れ

```
【1回目の実行】

対象: last_login_at < 2024-01-15 AND is_active = true のユーザー
→ 150人が該当
→ 150人を is_active = false に更新
→ 結果: 150件更新


【2回目の実行】（1分後に再実行）

対象: last_login_at < 2024-01-15 AND is_active = true のユーザー
→ 0人が該当（さっき全員 false にしたから）
→ 0人を更新
→ 結果: 0件更新


【翌日の実行】

対象: last_login_at < 2024-01-16 AND is_active = true のユーザー
→ 新たに90日経過した人だけが該当
→ その人だけを更新
```

---

## デプロイの設定

### Dockerfile.job

```dockerfile
# ビルドステージ
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /job ./cmd/job

# 実行ステージ
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /job .
ENTRYPOINT ["/app/job"]
```

**ポイント:**
- API用の Dockerfile とほぼ同じ
- 違いは `./cmd/job` をビルドしていること

### cloudbuild-job.yaml

```yaml
steps:
  # 1. Dockerイメージをビルド
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '...', '-f', 'Dockerfile.job', '.']

  # 2. イメージをプッシュ
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '...']

  # 3. Cloud Run Jobs にデプロイ
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'gcloud'
      - 'run'
      - 'jobs'           # ← 'services' ではなく 'jobs'
      - 'deploy'
      - 'deactivate-inactive-users'
      - '--set-secrets'
      - 'DATABASE_URL=DATABASE_URL:latest'
      - '--max-retries'
      - '3'              # ← 失敗したら3回までリトライ
      - '--task-timeout'
      - '300s'           # ← 5分でタイムアウト
```

**API との違い:**
- `gcloud run services deploy` ではなく `gcloud run jobs deploy`
- `--max-retries` でリトライ回数を指定
- `--task-timeout` でタイムアウトを指定

---

## テストの書き方

### ユニットテスト

```go
func TestDeactivateInteractor_Execute(t *testing.T) {
    // モックを準備
    mockRepo := &MockAccountRepository{}
    mockOutput := &MockDeactivateJobOutputPort{}

    // 10件更新されるようにモックを設定
    mockRepo.DeactivateByLastLoginBeforeFunc = func(ctx context.Context, before time.Time) (int, error) {
        return 10, nil
    }

    mockOutput.PresentResultFunc = func(ctx context.Context, count int) error {
        return nil
    }

    // テスト実行
    interactor := usecase.NewDeactivateInteractor(mockRepo, mockOutput)
    err := interactor.Execute(context.Background())

    // 検証
    assert.NoError(t, err)
}
```

### インテグレーションテスト

実際のDBを使ってテスト。testcontainers-go で PostgreSQL を起動。

```go
func TestAccountRepository_DeactivateByLastLoginBefore(t *testing.T) {
    // テスト用DBを起動
    ctx := context.Background()
    pool := setupTestDB(t)
    repo := sqlc.NewAccountRepository(pool)

    // テストデータを作成
    // - 91日前にログイン、is_active = true → 無効化対象
    // - 89日前にログイン、is_active = true → 対象外
    // - 91日前にログイン、is_active = false → 既に無効化済み
    createTestUsers(t, pool)

    // 実行
    before := time.Now().AddDate(0, 0, -90)
    count, err := repo.DeactivateByLastLoginBefore(ctx, before)

    // 検証
    assert.NoError(t, err)
    assert.Equal(t, 1, count)  // 91日前の active ユーザーのみ

    // 冪等性の検証
    count2, _ := repo.DeactivateByLastLoginBefore(ctx, before)
    assert.Equal(t, 0, count2)  // 2回目は0件
}
```

---

## 定期実行の設定

### Cloud Scheduler との連携

```
Cloud Scheduler (毎日 03:00)
    ↓ HTTP リクエスト
Cloud Run Jobs (deactivate-inactive-users)
    ↓ 処理実行
ログ出力 & 終了
```

### cron式の書き方

```
┌───────────── 分 (0-59)
│ ┌─────────── 時 (0-23)
│ │ ┌───────── 日 (1-31)
│ │ │ ┌─────── 月 (1-12)
│ │ │ │ ┌───── 曜日 (0-6, 0=日曜)
│ │ │ │ │
* * * * *

例:
0 3 * * *     毎日 03:00
0 0 1 * *     毎月1日 00:00
0 9 * * 1     毎週月曜 09:00
*/15 * * * *  15分ごと
```

---

## トラブルシューティング

### ジョブが失敗する

**エラー: DATABASE_URL is not set**
```
原因: 環境変数が設定されていない
対処: Cloud Run Jobs の設定で --set-secrets が正しいか確認
```

**エラー: connection refused**
```
原因: DBに接続できない
対処:
1. DATABASE_URL の値が正しいか確認
2. Neon がアクティブか確認
```

### 0件しか更新されない

```
原因1: 90日以上ログインしていないユーザーがいない
対処: Neon のコンソールで last_login_at を確認

原因2: 既に全員 is_active = false になっている
対処: 正常動作。冪等性が保たれている証拠
```

---

## まとめ

### 実装のポイント

1. **冪等性**: `AND is_active = true` で何回実行しても安全
2. **終了コード**: 成功は0、失敗は1で Cloud Run Jobs にリトライさせる
3. **ログ**: 処理件数を出力して、後から確認できるようにする

### 関連ドキュメント

- [バッチ処理入門](./11_batch_processing_guide.md) - 基礎知識
- [Cloud Run Jobs セットアップ](../../docs/setup-cloud-run-jobs.md) - デプロイ手順
- [クリーンアーキテクチャガイド](./02_clean_architecture_guide.md) - 設計思想
