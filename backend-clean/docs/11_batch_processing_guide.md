# バッチ処理入門ガイド

このドキュメントでは、バッチ処理の基本概念から実践的な設計パターンまでを解説します。

---

## 目次

1. [バッチ処理とは？](#バッチ処理とは)
2. [いつバッチ処理を使うのか？](#いつバッチ処理を使うのか)
3. [バッチ処理の起動方法](#バッチ処理の起動方法)
4. [バッチ処理で気をつけるべき点](#バッチ処理で気をつけるべき点)
5. [GCPでのバッチ処理実装](#gcpでのバッチ処理実装)
6. [実践例：非アクティブユーザーの無効化](#実践例非アクティブユーザーの無効化)

---

## バッチ処理とは？

### 一言で言うと

> **まとめて処理すること**

ユーザーのリクエストに対してリアルタイムに応答するのではなく、**一定量のデータをまとめて処理**する方式です。

### リアルタイム処理との違い

```
┌─────────────────────────────────────────────────────────────────┐
│                    リアルタイム処理                               │
│                                                                  │
│   ユーザー ──リクエスト──▶ サーバー ──レスポンス──▶ ユーザー      │
│                             │                                    │
│                        即座に処理                                 │
│                                                                  │
│   例: API、Webページ表示、検索                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      バッチ処理                                  │
│                                                                  │
│   データ ─────┐                                                  │
│   データ ─────┼──▶ まとめて処理 ──▶ 結果                        │
│   データ ─────┘      （後で）                                    │
│                                                                  │
│   例: 日次集計、月末請求、レポート生成                            │
└─────────────────────────────────────────────────────────────────┘
```

### 身近な例で理解する

| シーン | リアルタイム処理 | バッチ処理 |
|--------|-----------------|-----------|
| 銀行 | ATMで残高照会 | 月末の利息計算 |
| ECサイト | 商品購入 | 売上レポート生成 |
| SNS | 投稿する | おすすめユーザー計算 |
| 動画サイト | 動画視聴 | 視聴ランキング集計 |

---

## いつバッチ処理を使うのか？

### バッチ処理が適しているケース

#### 1. 大量データの処理

```
❌ リアルタイムだと...
「100万件のユーザーデータを集計して」
→ APIのタイムアウト（30秒）で終わらない！

✅ バッチなら...
→ 時間をかけて確実に処理できる
```

#### 2. 定期的な処理

```
毎日やること:
- 日次売上レポート生成
- ログの集計・分析
- バックアップ

毎月やること:
- 請求書の生成
- 給与計算
- 月次レポート
```

#### 3. 即時性が不要な処理

```
「今すぐ結果が必要」ではない処理:
- メルマガ配信
- 画像のリサイズ・最適化
- 検索インデックスの更新
```

#### 4. システム負荷を分散したい

```
日中: ユーザーアクセスが多い
    → リアルタイム処理に集中

深夜: ユーザーアクセスが少ない
    → 重い処理はバッチで実行
```

### バッチ処理が適さないケース

| ケース | 理由 | 代替手段 |
|--------|------|---------|
| ユーザーが結果を待っている | 体験が悪い | リアルタイム処理 |
| 1件だけの処理 | オーバーヘッドが大きい | API |
| リアルタイムの通知 | 遅延が許容されない | WebSocket/Push |

---

## バッチ処理の起動方法

バッチ処理をいつ・どうやって起動するかには、いくつかのパターンがあります。

### 1. スケジュール実行（定期バッチ）

> **決まった時間に自動実行**

```
┌─────────────────┐         ┌─────────────────┐
│   Scheduler     │         │   Batch Job     │
│                 │         │                 │
│  毎日 03:00     │────────▶│  処理を実行     │
│  毎週月曜 09:00 │  トリガー │                 │
│  毎月1日 00:00  │         │                 │
└─────────────────┘         └─────────────────┘
```

**使用例:**
- 日次売上集計（毎日深夜）
- 月次請求処理（毎月1日）
- 週次レポート生成（毎週月曜）
- 非アクティブユーザーの無効化（毎日）

**GCPでの実装:**
- **Cloud Scheduler** + **Cloud Run Jobs**

```yaml
# Cloud Scheduler の設定例
name: daily-report-job
schedule: "0 3 * * *"  # 毎日03:00
time_zone: "Asia/Tokyo"
target: Cloud Run Jobs
```

**cron式の読み方:**
```
┌───────────── 分 (0-59)
│ ┌─────────── 時 (0-23)
│ │ ┌───────── 日 (1-31)
│ │ │ ┌─────── 月 (1-12)
│ │ │ │ ┌───── 曜日 (0-6, 0=日曜)
│ │ │ │ │
* * * * *

例:
"0 3 * * *"     → 毎日 03:00
"0 9 * * 1"     → 毎週月曜 09:00
"0 0 1 * *"     → 毎月1日 00:00
"*/15 * * * *"  → 15分ごと
```

---

### 2. イベント駆動（Pub/Sub）

> **何かが起きたら実行**

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   発火元    │      │   Pub/Sub   │      │  Batch Job  │
│             │      │   (キュー)  │      │             │
│ ファイル    │─────▶│  メッセージ │─────▶│  処理実行   │
│ アップロード│ 発行  │  を保持     │ 配信  │             │
└─────────────┘      └─────────────┘      └─────────────┘
```

**使用例:**
- 画像アップロード → サムネイル生成
- 注文確定 → 在庫更新 + メール送信
- ユーザー登録 → ウェルカムメール送信
- ログ出力 → ログ集計処理

**GCPでの実装:**
- **Cloud Pub/Sub** + **Cloud Run** または **Cloud Functions**

```
Publisher                    Subscriber
   │                            │
   │  publish("order-topic",    │
   │    {orderId: 123})         │
   │──────────────────────────▶│
   │                            │
   │                     メッセージを受信
   │                     処理を実行
```

**メリット:**
- 処理の疎結合（発火元と処理が分離）
- 非同期処理（発火元は待たなくていい）
- リトライが自動（失敗しても再配信）

---

### 3. タスクキュー（Cloud Tasks）

> **後で実行してほしい処理をキューに入れる**

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   API       │      │ Cloud Tasks │      │  Worker     │
│             │      │   (キュー)  │      │             │
│ リクエスト  │─────▶│  タスク追加 │─────▶│  処理実行   │
│ 受付        │ 追加  │  順番待ち   │ 実行  │             │
└─────────────┘      └─────────────┘      └─────────────┘
         │
         │ すぐにレスポンス
         ▼
      ユーザー
```

**Pub/Sub との違い:**

| 項目 | Pub/Sub | Cloud Tasks |
|------|---------|-------------|
| 配信タイミング | 即座 | 指定可能（遅延実行） |
| 宛先 | 複数可能（ブロードキャスト） | 1つ（特定のエンドポイント） |
| ユースケース | イベント通知 | 処理の後回し |
| レート制限 | なし | あり（秒間N件まで） |

**使用例:**
- メール送信（即座に返したいが送信は後で）
- 外部API呼び出し（レート制限がある場合）
- 重い処理の後回し

**GCPでの実装:**
- **Cloud Tasks** + **Cloud Run** または **Cloud Functions**

```go
// タスクを追加（5分後に実行）
task := &taskspb.Task{
    ScheduleTime: timestamppb.New(time.Now().Add(5 * time.Minute)),
    MessageType: &taskspb.Task_HttpRequest{
        HttpRequest: &taskspb.HttpRequest{
            Url:        "https://my-service/process",
            HttpMethod: taskspb.HttpMethod_POST,
            Body:       []byte(`{"userId": 123}`),
        },
    },
}
client.CreateTask(ctx, &taskspb.CreateTaskRequest{
    Parent: queuePath,
    Task:   task,
})
```

---

### 4. 手動実行

> **必要な時に人が実行**

```
開発者/運用者
    │
    │ gcloud run jobs execute my-job
    ▼
┌─────────────┐
│  Batch Job  │
│             │
│  処理実行   │
└─────────────┘
```

**使用例:**
- データ移行
- 障害復旧
- 一時的なメンテナンス作業
- テスト実行

---

### 起動方法の選び方

```
「いつ実行する？」

定期的に実行したい
    → スケジュール実行（Cloud Scheduler）

何かが起きたら実行したい
    → イベント駆動（Pub/Sub）

処理を後回しにしたい
    → タスクキュー（Cloud Tasks）

必要な時だけ実行したい
    → 手動実行
```

```
┌────────────────────────────────────────────────────────────────┐
│                      判断フローチャート                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   処理のトリガーは？                                            │
│        │                                                       │
│        ├─ 時間ベース（毎日/毎週/毎月）                          │
│        │      → Cloud Scheduler + Cloud Run Jobs              │
│        │                                                       │
│        ├─ イベントベース（ファイルアップロード/データ変更）      │
│        │      → Pub/Sub + Cloud Run/Functions                 │
│        │                                                       │
│        ├─ APIリクエストの延長（重い処理を後回し）               │
│        │      → Cloud Tasks + Cloud Run                       │
│        │                                                       │
│        └─ 手動/不定期                                          │
│               → Cloud Run Jobs（手動実行）                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## バッチ処理で気をつけるべき点

### 1. 冪等性（べきとうせい）

#### 冪等性とは？

> **同じ処理を何度実行しても、結果が同じになる性質**

```
冪等な処理:
1回目: 100件更新 → 結果: 100件が更新された状態
2回目: 0件更新   → 結果: 100件が更新された状態（変わらない）
3回目: 0件更新   → 結果: 100件が更新された状態（変わらない）
```

#### なぜ重要？

バッチ処理は**失敗してリトライする**ことがよくあります。

```
❌ 冪等でない場合:

1回目: ポイント100付与 → ユーザーのポイント: 100
2回目: ポイント100付与 → ユーザーのポイント: 200  ← 二重付与！

ネットワークエラー → リトライ → 二重処理 → バグ！
```

```
✅ 冪等な場合:

1回目: ポイント100に設定 → ユーザーのポイント: 100
2回目: ポイント100に設定 → ユーザーのポイント: 100  ← 変わらない

何度実行しても同じ結果 → 安全にリトライできる
```

#### 冪等性を実現するテクニック

**テクニック1: 条件を追加する**

```sql
-- ❌ 冪等でない
UPDATE accounts SET is_active = false
WHERE last_login_at < '2024-01-01';

-- ✅ 冪等
UPDATE accounts SET is_active = false
WHERE last_login_at < '2024-01-01'
  AND is_active = true;  -- ← 既に無効化済みは対象外
```

**テクニック2: UPSERT（INSERT or UPDATE）を使う**

```sql
-- ❌ 冪等でない（2回目はエラーになる可能性）
INSERT INTO daily_reports (date, total) VALUES ('2024-01-01', 1000);

-- ✅ 冪等（存在すれば更新、なければ挿入）
INSERT INTO daily_reports (date, total) VALUES ('2024-01-01', 1000)
ON CONFLICT (date) DO UPDATE SET total = EXCLUDED.total;
```

**テクニック3: 処理済みフラグを使う**

```sql
-- 処理済みのレコードをスキップ
UPDATE orders
SET status = 'shipped', processed_at = NOW()
WHERE status = 'confirmed'
  AND processed_at IS NULL;  -- ← 未処理のみ対象
```

**テクニック4: トランザクションIDを記録する**

```go
// 処理IDを生成（日付ベースなど）
batchID := fmt.Sprintf("batch-%s", time.Now().Format("2006-01-02"))

// 既に処理済みかチェック
if exists := checkBatchProcessed(batchID); exists {
    log.Println("already processed, skipping")
    return nil
}

// 処理実行
process()

// 処理済みとして記録
markBatchProcessed(batchID)
```

---

### 2. エラーハンドリング

#### リトライ戦略

```
┌────────────────────────────────────────────────────────────────┐
│                     リトライの考え方                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  一時的なエラー（リトライすべき）:                              │
│  - ネットワークタイムアウト                                     │
│  - DB接続エラー                                                 │
│  - 外部APIの一時的な障害                                        │
│                                                                │
│  恒久的なエラー（リトライしても無駄）:                          │
│  - バリデーションエラー                                         │
│  - 認証エラー                                                   │
│  - 存在しないリソースへのアクセス                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Exponential Backoff（指数バックオフ）

```
リトライ間隔を指数的に増やす戦略

1回目の失敗 → 1秒待つ  → リトライ
2回目の失敗 → 2秒待つ  → リトライ
3回目の失敗 → 4秒待つ  → リトライ
4回目の失敗 → 8秒待つ  → リトライ
5回目の失敗 → 16秒待つ → リトライ
...
最大リトライ回数に達したら → 失敗として終了
```

```go
// Exponential Backoff の実装例
func retryWithBackoff(fn func() error, maxRetries int) error {
    for i := 0; i < maxRetries; i++ {
        err := fn()
        if err == nil {
            return nil
        }

        // 待機時間: 2^i 秒（1, 2, 4, 8, 16...）
        waitTime := time.Duration(1<<i) * time.Second
        log.Printf("retry %d/%d, waiting %v", i+1, maxRetries, waitTime)
        time.Sleep(waitTime)
    }
    return fmt.Errorf("max retries exceeded")
}
```

#### 終了コードの設計

```go
const (
    ExitSuccess = 0  // 正常終了
    ExitError   = 1  // エラー終了（リトライ対象）
)

func main() {
    if err := run(); err != nil {
        log.Printf("batch failed: %v", err)
        os.Exit(ExitError)  // Cloud Run Jobs がリトライ
    }
    os.Exit(ExitSuccess)
}
```

---

### 3. タイムアウト設計

#### 適切なタイムアウト設定

```
処理時間の見積もり:
- 通常時: 30秒
- 最大時: 2分（データ量が多い場合）

タイムアウト設定:
- 余裕を持って 5分 に設定
- あまり長すぎると障害検知が遅れる
```

```yaml
# Cloud Run Jobs の設定
spec:
  template:
    spec:
      timeoutSeconds: 300  # 5分
      containers:
        - name: batch-job
```

#### 処理の分割

```
❌ 1つのバッチで全部やる:
→ 100万件を1回で処理
→ タイムアウト or メモリ不足

✅ 小さく分割:
→ 1万件ずつ100回に分けて処理
→ 1回の処理が軽い
→ 途中で失敗しても途中から再開できる
```

---

### 4. 監視とアラート

#### ログの重要性

```go
func (u *DeactivateInteractor) Execute(ctx context.Context) error {
    // 開始ログ
    log.Println("starting deactivation batch")

    count, err := u.repo.DeactivateInactiveUsers(ctx)
    if err != nil {
        // エラーログ（詳細を含める）
        log.Printf("failed to deactivate users: %v", err)
        return err
    }

    // 完了ログ（処理結果を含める）
    log.Printf("completed: deactivated %d users", count)
    return nil
}
```

#### アラート設計

| 条件 | 重要度 | アクション |
|------|--------|-----------|
| バッチ失敗 | 高 | 即座に通知（Slack/PagerDuty） |
| 実行時間が長い | 中 | 警告通知 |
| 処理件数が異常 | 中 | ログ確認を促す |
| 0件処理 | 低 | ログに記録（正常かもしれない） |

---

### 5. 排他制御

#### 同時実行の問題

```
❌ 同じバッチが同時に2つ起動すると...

バッチA: ユーザー1を処理中...
バッチB: ユーザー1を処理中...（同時に）
→ 競合状態（Race Condition）
→ データ不整合
```

#### 対策1: Cloud Run Jobs の設定

```yaml
# 同時実行を1に制限
spec:
  template:
    spec:
      maxRetries: 3
      parallelism: 1  # 並列実行しない
```

#### 対策2: 分散ロック

```go
// Redis などを使った分散ロック
func (b *Batch) Run(ctx context.Context) error {
    // ロック取得を試みる
    lock, err := b.locker.Acquire(ctx, "deactivate-batch", 5*time.Minute)
    if err != nil {
        log.Println("another batch is running, skipping")
        return nil  // 他のバッチが実行中なのでスキップ
    }
    defer lock.Release()

    // 処理実行
    return b.process(ctx)
}
```

---

## GCPでのバッチ処理実装

### サービス選択ガイド

```
┌────────────────────────────────────────────────────────────────┐
│                   GCPのバッチ処理サービス                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Cloud Run Jobs                                                │
│  ├─ コンテナベース                                              │
│  ├─ 最大24時間実行可能                                          │
│  ├─ スケジュール実行（Cloud Scheduler連携）                     │
│  └─ おすすめ: 汎用的なバッチ処理                                │
│                                                                │
│  Cloud Functions                                               │
│  ├─ 関数ベース（軽量）                                          │
│  ├─ 最大60分（Gen2）                                            │
│  ├─ イベント駆動に最適                                          │
│  └─ おすすめ: 軽量なイベント処理                                │
│                                                                │
│  Dataflow                                                      │
│  ├─ Apache Beam ベース                                         │
│  ├─ 大規模データ処理向け                                        │
│  ├─ ストリーミング/バッチ両対応                                 │
│  └─ おすすめ: TB級のデータ処理                                  │
│                                                                │
│  Cloud Composer                                                │
│  ├─ Apache Airflow ベース                                      │
│  ├─ 複雑なワークフロー管理                                      │
│  ├─ DAG（有向非巡回グラフ）で依存関係定義                       │
│  └─ おすすめ: 複数ジョブの依存関係管理                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Cloud Run Jobs + Cloud Scheduler の構成

```
┌─────────────────────────────────────────────────────────────────┐
│                          GCP                                     │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  Cloud Scheduler │                                           │
│  │                  │                                           │
│  │  cron: 0 3 * * * │                                           │
│  │  (毎日 03:00)    │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           │ HTTP トリガー                                        │
│           ▼                                                      │
│  ┌──────────────────┐      ┌─────────────────────────────────┐ │
│  │  Cloud Run Jobs  │      │        Secret Manager           │ │
│  │                  │◀────▶│                                 │ │
│  │  deactivate-job  │      │  DATABASE_URL                   │ │
│  │                  │      │  API_KEY                        │ │
│  └────────┬─────────┘      └─────────────────────────────────┘ │
│           │                                                      │
│           │ SQL                                                  │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │    Cloud SQL     │                                           │
│  │   (PostgreSQL)   │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 実践例：非アクティブユーザーの無効化

### 要件

```
目的: 90日以上ログインしていないユーザーを無効化する
実行タイミング: 毎日深夜 03:00
処理内容: is_active = false に更新
```

### アーキテクチャ

```
cmd/job/main.go
    │
    ▼
initializer
    │
    ├─▶ Controller（処理の制御）
    │       │
    │       ├─▶ UseCase（ビジネスロジック）
    │       │       │
    │       │       └─▶ Repository（DB操作）
    │       │
    │       └─▶ Presenter（結果の出力）
    │
    └─▶ 終了コード (0 or 1)
```

### コードの流れ

```go
// 1. エントリーポイント (cmd/job/main.go)
func main() {
    count, err := initializer.RunDeactivateInactiveUsers(ctx)
    if err != nil {
        log.Printf("job failed: %v", err)
        os.Exit(1)
    }
    log.Printf("completed: %d users deactivated", count)
    os.Exit(0)
}

// 2. UseCase (usecase/deactivate_job_interactor.go)
func (u *DeactivateInteractor) Execute(ctx context.Context) error {
    // 90日前の日付を計算
    before := time.Now().AddDate(0, 0, -90)

    // Repository で更新
    count, err := u.repo.DeactivateByLastLoginBefore(ctx, before)
    if err != nil {
        return err
    }

    // Presenter に結果を渡す
    return u.output.PresentResult(ctx, count)
}

// 3. Repository (adapter/gateway/db/sqlc/account_repository.go)
func (r *AccountRepository) DeactivateByLastLoginBefore(
    ctx context.Context,
    before time.Time,
) (int, error) {
    query := `
        UPDATE accounts
        SET is_active = false, updated_at = NOW()
        WHERE last_login_at < $1
          AND is_active = true  -- 冪等性のため
    `
    result, err := r.pool.Exec(ctx, query, before)
    if err != nil {
        return 0, err
    }
    return int(result.RowsAffected()), nil
}
```

### 冪等性の確認

```
1回目の実行:
  - 対象: 100件（90日以上ログインなし & is_active = true）
  - 結果: 100件を is_active = false に更新

2回目の実行:
  - 対象: 0件（is_active = true のユーザーは既にいない）
  - 結果: 何も更新されない

→ 何度実行しても安全！
```

---

## まとめ

### バッチ処理を使う場面

1. 大量データの処理
2. 定期的な処理
3. 即時性が不要な処理
4. システム負荷の分散

### 起動方法の選択

| 要件 | 起動方法 | GCPサービス |
|------|---------|------------|
| 定期実行 | スケジュール | Cloud Scheduler + Cloud Run Jobs |
| イベント駆動 | Pub/Sub | Cloud Pub/Sub + Cloud Run |
| 処理の後回し | タスクキュー | Cloud Tasks + Cloud Run |
| 手動実行 | CLI | Cloud Run Jobs |

### 設計のポイント

1. **冪等性**: 何度実行しても同じ結果になるように
2. **エラーハンドリング**: リトライ可能な設計
3. **タイムアウト**: 適切な制限時間を設定
4. **監視**: ログとアラートを整備
5. **排他制御**: 同時実行の問題を防ぐ

---

## 関連ドキュメント

- [10_batch_job_design.md](./10_batch_job_design.md) - ジョブ処理の詳細設計
- [02_clean_architecture_guide.md](./02_clean_architecture_guide.md) - クリーンアーキテクチャの基本
- [06_testing_strategy.md](./06_testing_strategy.md) - テスト戦略
