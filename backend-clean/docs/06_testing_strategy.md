# 🧪 テスト戦略ガイド - 現場で使える実践的アプローチ

> 💡 **このドキュメントのゴール**
> テストの基礎から、Clean Architectureでのテスト戦略まで、
> 「なぜそのテストが必要なのか」を腑に落ちるレベルで理解する

---

## 📚 目次

1. [テストの基礎知識](#テストの基礎知識)
2. [テストピラミッド](#テストピラミッド)
3. [Clean Architectureでのテスト戦略](#clean-architectureでのテスト戦略)
4. [各レイヤーのテスト詳細](#各レイヤーのテスト詳細)
5. [testcontainers-goの使い方](#testcontainers-goの使い方)
6. [よくある質問](#よくある質問)

---

## テストの基礎知識

### 🎯 なぜテストを書くのか？

```
テストがない世界:
┌────────────────────────────────────┐
│  機能追加                          │
│    ↓                               │
│  「動いた！」→ 本番デプロイ         │
│    ↓                               │
│  3日後: 「なんかバグってる...」     │
│    ↓                               │
│  原因調査に半日、修正に半日         │
│    ↓                               │
│  また別のバグが...（無限ループ）    │
└────────────────────────────────────┘

テストがある世界:
┌────────────────────────────────────┐
│  機能追加                          │
│    ↓                               │
│  テスト実行 → 失敗を検出！          │
│    ↓                               │
│  修正 → テスト成功                  │
│    ↓                               │
│  安心して本番デプロイ               │
│    ↓                               │
│  バグ激減、開発が楽しい！           │
└────────────────────────────────────┘
```

---

### 📊 テストの種類

| 種類 | 何をテストする？ | 速度 | 信頼性 |
|------|-----------------|------|--------|
| **Unit Test** | 関数・メソッド単体 | ⚡ 超速い | 高い |
| **Integration Test** | 複数コンポーネント連携 | 🚀 やや遅い | 中程度 |
| **E2E Test** | システム全体 | 🐢 遅い | 低い（壊れやすい） |

---

### 🔍 テストカバレッジの種類

```
C0（Statement Coverage）:
  すべての「行」を実行したか？
  → 最低限のカバレッジ

C1（Branch Coverage）:
  すべての「分岐」を通ったか？
  → if文のtrue/false両方をテスト
  → 現場で最もよく使う

C2（Condition Coverage）:
  すべての「条件の組み合わせ」をテストしたか？
  → 複雑すぎて現実的ではない
```

**例：C1カバレッジ**

```go
func CanPublish(note Note) error {
    if note.Status != StatusDraft {  // ← 分岐1
        return ErrInvalidStatus
    }
    if len(note.Sections) == 0 {     // ← 分岐2
        return ErrNoSections
    }
    return nil
}

// C1達成には最低3ケース必要:
// 1. Status == Draft && Sections > 0  → 成功
// 2. Status != Draft                  → 分岐1でエラー
// 3. Sections == 0                    → 分岐2でエラー
```

---

## テストピラミッド

### 🔺 理想的なテスト構成

```
            ▲
           /E2E\              少ない（5-10%）
          /─────\             遅い、壊れやすい
         /       \            主要フローのみ
        / Integra-\
       /   tion    \          中程度（20-30%）
      /─────────────\         DB連携の検証
     /               \
    /    Unit Test    \       多い（60-70%）
   /───────────────────\      速い、安定
  /                     \     ロジックの検証
```

### なぜピラミッド型？

```
❌ アイスクリームコーン型（アンチパターン）

        ▓▓▓▓▓▓▓▓▓▓▓
       ▓ E2E Test  ▓     ← 多すぎ！遅い、壊れやすい
        ▓▓▓▓▓▓▓▓▓▓▓
           ▓▓▓
          ▓ Int ▓         ← 少ない
           ▓▓▓
            ▓
           ▓Unit▓         ← 少なすぎ！
            ▓

問題:
├─ E2Eが多いと実行時間が長い（30分以上）
├─ 環境依存で不安定（CI失敗が頻発）
├─ デバッグが困難（どこで失敗したかわからない）
└─ メンテナンスコストが高い
```

```
✅ ピラミッド型（推奨）

            ▲
           /E2E\              ← 少数（主要フロー）
          /─────\
         / Integra-\          ← 中程度
        /   tion    \
       /─────────────\
      /    Unit Test  \       ← 多数（高速）
     /─────────────────\

メリット:
├─ 実行時間が短い（数分）
├─ 安定している（環境依存が少ない）
├─ デバッグしやすい（失敗箇所が明確）
└─ メンテナンスコストが低い
```

---

## Clean Architectureでのテスト戦略

### 🏗️ レイヤー別テスト方針

```
┌─────────────────────────────────────────────────────────────────┐
│                  Clean Architecture テスト戦略                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Unit Test（モック使用）                                 │   │
│  │                                                         │   │
│  │  Domain層        ✅ 必須   純粋なビジネスルール          │   │
│  │  UseCase層       ✅ 必須   ビジネスロジックの流れ        │   │
│  │  Controller層    ✅ 必須   バインド、変換、エラー        │   │
│  │  Presenter層     ✅ 推奨   Domain→OpenAPI変換           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Integration Test（testcontainers-go）                   │   │
│  │                                                         │   │
│  │  Repository層    ✅ 必須   SQLの正しさ、DB制約           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  E2E Test（testcontainers-go）                           │   │
│  │                                                         │   │
│  │  API全体         ✅ 主要フロー   認証→CRUD→エラー        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 📊 まとめ表

| レイヤー | Unit Test | Integration Test | E2E | テスト内容 |
|---------|-----------|------------------|-----|-----------|
| **Domain** | ✅ 必須 | ❌ | - | バリデーション、状態遷移 |
| **UseCase** | ✅ 必須 | ❌ | - | ビジネスロジック（モック） |
| **Controller** | ✅ 必須 | ❌ | - | バインド、変換、エラーマッピング |
| **Presenter** | ✅ 推奨 | ❌ | - | Domain→OpenAPI変換 |
| **Repository** | ⚠️ 限定的 | ✅ 必須 | - | SQL、DB制約（testcontainers） |
| **API全体** | - | - | ✅ 主要フロー | 認証→CRUD |

---

## 各レイヤーのテスト詳細

### 1️⃣ Domain層のテスト

**目的**: ビジネスルールが正しく動作するか検証

**特徴**:
- 外部依存なし（モック不要）
- 純粋関数のテスト
- 超高速

```go
// internal/domain/note/logic_test.go
func TestValidateNoteForPublish(t *testing.T) {
    tests := []struct {
        name    string
        note    note.Note
        wantErr error
    }{
        {
            name: "[Success] 公開可能なノート",
            note: note.Note{
                Status:   note.StatusDraft,
                Sections: []note.Section{{Content: "内容あり"}},
            },
            wantErr: nil,
        },
        {
            name: "[Fail] 既に公開済み",
            note: note.Note{
                Status: note.StatusPublish,
            },
            wantErr: domainerr.ErrInvalidStatus,
        },
        {
            name: "[Fail] セクションが空",
            note: note.Note{
                Status:   note.StatusDraft,
                Sections: []note.Section{},
            },
            wantErr: domainerr.ErrNoSections,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := service.ValidateNoteForPublish(tt.note)
            if err != tt.wantErr {
                t.Errorf("want %v, got %v", tt.wantErr, err)
            }
        })
    }
}
```

---

### 2️⃣ UseCase層のテスト

**目的**: ビジネスロジックの流れが正しいか検証

**特徴**:
- Repositoryをモックで差し替え
- DBアクセスなし（高速）
- 異常系もテストしやすい

```go
// internal/usecase/note_interactor_test.go
func TestNoteInteractor_Publish(t *testing.T) {
    tests := []struct {
        name      string
        noteID    string
        ownerID   string
        setupMock func(*mock.MockNoteRepository)
        wantErr   error
    }{
        {
            name:    "[Success] 公開成功",
            noteID:  "note-123",
            ownerID: "owner-123",
            setupMock: func(repo *mock.MockNoteRepository) {
                // Getが呼ばれたらノートを返す
                repo.EXPECT().
                    Get(gomock.Any(), "note-123").
                    Return(&note.WithMeta{
                        Note: note.Note{
                            ID:      "note-123",
                            OwnerID: "owner-123",
                            Status:  note.StatusDraft,
                        },
                    }, nil)

                // Updateが呼ばれる
                repo.EXPECT().
                    Update(gomock.Any(), gomock.Any()).
                    Return(&note.Note{Status: note.StatusPublish}, nil)
            },
            wantErr: nil,
        },
        {
            name:    "[Fail] ノートが見つからない",
            noteID:  "not-found",
            ownerID: "owner-123",
            setupMock: func(repo *mock.MockNoteRepository) {
                repo.EXPECT().
                    Get(gomock.Any(), "not-found").
                    Return(nil, domainerr.ErrNotFound)
            },
            wantErr: domainerr.ErrNotFound,
        },
        {
            name:    "[Fail] 所有者が違う",
            noteID:  "note-123",
            ownerID: "other-owner",
            setupMock: func(repo *mock.MockNoteRepository) {
                repo.EXPECT().
                    Get(gomock.Any(), "note-123").
                    Return(&note.WithMeta{
                        Note: note.Note{
                            ID:      "note-123",
                            OwnerID: "owner-123",  // 違うオーナー
                        },
                    }, nil)
            },
            wantErr: domainerr.ErrUnauthorized,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctrl := gomock.NewController(t)
            defer ctrl.Finish()

            mockRepo := mock.NewMockNoteRepository(ctrl)
            mockOutput := presenter.NewNotePresenter()
            tt.setupMock(mockRepo)

            interactor := usecase.NewNoteInteractor(mockRepo, nil, nil, mockOutput)
            err := interactor.Publish(context.Background(), tt.noteID, tt.ownerID)

            if !errors.Is(err, tt.wantErr) {
                t.Errorf("want %v, got %v", tt.wantErr, err)
            }
        })
    }
}
```

---

### 3️⃣ Controller層のテスト

**目的**: HTTP層の振る舞いが正しいか検証

**テスト対象**:
- リクエストボディのバインド
- パラメータバリデーション（ownerID空チェック等）
- OpenAPI型→Domain型への変換
- ドメインエラー→HTTPステータスのマッピング

```go
// internal/adapter/http/controller/note_controller_test.go
func TestNoteController_Create(t *testing.T) {
    tests := []struct {
        name       string
        body       string
        wantStatus int
        wantBody   string
    }{
        {
            name:       "[Success] ノート作成成功",
            body:       `{"title":"Hello","templateId":"00000000-0000-0000-0000-000000000001","ownerId":"00000000-0000-0000-0000-000000000002"}`,
            wantStatus: http.StatusOK,
        },
        {
            name:       "[Fail] 不正なJSON",
            body:       `not-json`,
            wantStatus: http.StatusBadRequest,
            wantBody:   "invalid body",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // ... テスト実行
        })
    }
}

func TestNoteController_Update(t *testing.T) {
    tests := []struct {
        name       string
        body       string
        ownerID    string  // パラメータ
        wantStatus int
    }{
        {
            name:       "[Success] 更新成功",
            body:       `{"title":"New","sections":[]}`,
            ownerID:    "owner-123",
            wantStatus: http.StatusOK,
        },
        {
            name:       "[Fail] ownerIDが空",
            body:       `{"title":"New","sections":[]}`,
            ownerID:    "",  // 空！
            wantStatus: http.StatusForbidden,
        },
    }
    // ...
}
```

**エラーマッピングのテスト**:

```go
// internal/adapter/http/controller/helpers_test.go
func TestHandleError(t *testing.T) {
    tests := []struct {
        name       string
        err        error
        wantStatus int
    }{
        {
            name:       "ErrNotFound → 404",
            err:        domainerr.ErrNotFound,
            wantStatus: http.StatusNotFound,
        },
        {
            name:       "ErrUnauthorized → 403",
            err:        domainerr.ErrUnauthorized,
            wantStatus: http.StatusForbidden,
        },
        {
            name:       "ErrInvalidStatus → 400",
            err:        domainerr.ErrInvalidStatus,
            wantStatus: http.StatusBadRequest,
        },
        {
            name:       "未知のエラー → 500",
            err:        errors.New("unknown"),
            wantStatus: http.StatusInternalServerError,
        },
    }
    // ...
}
```

---

### 4️⃣ Presenter層のテスト

**目的**: Domain型→OpenAPI型の変換が正しいか検証

```go
// internal/adapter/http/presenter/note_presenter_test.go
func TestNotePresenter_PresentNote(t *testing.T) {
    tests := []struct {
        name     string
        input    note.WithMeta
        expected openapi.ModelsNoteResponse
    }{
        {
            name: "[Success] 変換成功",
            input: note.WithMeta{
                Note: note.Note{
                    ID:     "note-123",
                    Title:  "テストノート",
                    Status: note.StatusDraft,
                },
                TemplateName: "設計書",
            },
            expected: openapi.ModelsNoteResponse{
                Id:           "note-123",
                Title:        "テストノート",
                Status:       openapi.ModelsNoteStatusDraft,
                TemplateName: "設計書",
            },
        },
    }
    // ...
}
```

---

### 5️⃣ Repository層のIntegration Test

**目的**: SQLが正しく動作するか検証

**特徴**:
- testcontainers-goで実際のPostgreSQLを起動
- DB制約（UNIQUE、FK）の検証
- トランザクションの検証

```go
// internal/adapter/gateway/db/sqlc/note_repository_integration_test.go
func TestNoteRepository_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    // PostgreSQLコンテナ起動
    ctx := context.Background()
    pg := testutil.SetupPostgres(t)

    // Repository作成
    pool, _ := pgxpool.New(ctx, pg.ConnectionString)
    defer pool.Close()
    repo := sqlc.NewNoteRepository(pool)

    t.Run("Create and Get", func(t *testing.T) {
        // 作成
        created, err := repo.Create(ctx, note.Note{
            Title:      "テストノート",
            TemplateID: "tpl-123",
            OwnerID:    "owner-123",
            Status:     note.StatusDraft,
        })
        assert.NoError(t, err)
        assert.NotEmpty(t, created.ID)

        // 取得
        found, err := repo.Get(ctx, created.ID)
        assert.NoError(t, err)
        assert.Equal(t, "テストノート", found.Note.Title)
    })

    t.Run("Update", func(t *testing.T) {
        // ...
    })

    t.Run("Delete", func(t *testing.T) {
        // ...
    })

    t.Run("NotFound", func(t *testing.T) {
        _, err := repo.Get(ctx, "not-exist")
        assert.ErrorIs(t, err, domainerr.ErrNotFound)
    })
}
```

---

### 6️⃣ E2E Test

**目的**: 実際のHTTPリクエストでシステム全体が動作するか検証

**特徴**:
- testcontainers-goで実際のPostgreSQLを起動
- 実際のAPIサーバーを起動
- HTTPリクエストでテスト

```go
// tests/e2e/note_api_test.go
func TestNoteAPI_E2E(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping e2e test")
    }

    // PostgreSQLコンテナ起動
    pg := testutil.SetupPostgres(t)

    // APIサーバー起動
    server := testutil.StartTestServer(t, pg.ConnectionString)
    defer server.Close()

    t.Run("Create → Get → Update → Delete", func(t *testing.T) {
        // 1. 作成
        createResp, err := http.Post(
            server.URL+"/api/notes",
            "application/json",
            strings.NewReader(`{
                "title": "E2Eテスト",
                "templateId": "00000000-0000-0000-0000-000000000001",
                "ownerId": "00000000-0000-0000-0000-000000000002"
            }`),
        )
        assert.NoError(t, err)
        assert.Equal(t, http.StatusOK, createResp.StatusCode)

        var created map[string]interface{}
        json.NewDecoder(createResp.Body).Decode(&created)
        noteID := created["id"].(string)

        // 2. 取得
        getResp, err := http.Get(server.URL + "/api/notes/" + noteID)
        assert.NoError(t, err)
        assert.Equal(t, http.StatusOK, getResp.StatusCode)

        // 3. 削除
        deleteReq, _ := http.NewRequest(
            http.MethodDelete,
            server.URL+"/api/notes/"+noteID+"?ownerId=00000000-0000-0000-0000-000000000002",
            nil,
        )
        deleteResp, err := http.DefaultClient.Do(deleteReq)
        assert.NoError(t, err)
        assert.Equal(t, http.StatusOK, deleteResp.StatusCode)
    })

    t.Run("NotFound", func(t *testing.T) {
        resp, _ := http.Get(server.URL + "/api/notes/not-exist")
        assert.Equal(t, http.StatusNotFound, resp.StatusCode)
    })
}
```

---

## testcontainers-goの使い方

### 📦 セットアップ

```bash
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres
```

### 🔧 共通ヘルパー

```go
// tests/testutil/postgres.go
package testutil

import (
    "context"
    "testing"

    "github.com/golang-migrate/migrate/v4"
    _ "github.com/golang-migrate/migrate/v4/database/postgres"
    _ "github.com/golang-migrate/migrate/v4/source/file"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
)

type PostgresContainer struct {
    *postgres.PostgresContainer
    ConnectionString string
}

func SetupPostgres(t *testing.T) *PostgresContainer {
    t.Helper()
    ctx := context.Background()

    // PostgreSQLコンテナ起動
    pgContainer, err := postgres.Run(ctx,
        "postgres:15-alpine",
        postgres.WithDatabase("test_db"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections").
                WithOccurrence(2),
        ),
    )
    if err != nil {
        t.Fatalf("failed to start postgres: %v", err)
    }

    // 接続文字列取得
    connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
    if err != nil {
        t.Fatalf("failed to get connection string: %v", err)
    }

    // マイグレーション実行
    if err := runMigrations(connStr); err != nil {
        t.Fatalf("failed to run migrations: %v", err)
    }

    // テスト終了時にコンテナを停止
    t.Cleanup(func() {
        pgContainer.Terminate(ctx)
    })

    return &PostgresContainer{
        PostgresContainer: pgContainer,
        ConnectionString:  connStr,
    }
}

func runMigrations(connStr string) error {
    m, err := migrate.New(
        "file://../../migrations",
        connStr,
    )
    if err != nil {
        return err
    }
    defer m.Close()

    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return err
    }
    return nil
}
```

### 🚀 テストサーバー起動

```go
// tests/testutil/server.go
package testutil

import (
    "context"
    "net/http/httptest"
    "testing"

    "immortal-architecture-clean/backend/internal/driver/initializer/api"
)

func StartTestServer(t *testing.T, dbConnStr string) *httptest.Server {
    t.Helper()

    // テスト用の設定でサーバー構築
    e, cleanup, err := api.BuildServerWithDB(context.Background(), dbConnStr)
    if err != nil {
        t.Fatalf("failed to build server: %v", err)
    }

    // テストサーバー起動
    server := httptest.NewServer(e)

    t.Cleanup(func() {
        server.Close()
        cleanup()
    })

    return server
}
```

### ⚡ 実行方法

```bash
# 全テスト実行
go test ./...

# Unit Testのみ（高速）
go test -short ./...

# Integration Test含む
go test ./...

# 特定のテストを実行
go test -run TestNoteRepository_Integration ./internal/adapter/gateway/db/sqlc/

# E2Eテストのみ
go test ./tests/e2e/...
```

---

## よくある質問

### Q1: Controller + DB の Integration Test は必要？

**A: 不要です。E2Eと重複するからです。**

```
テストカバー範囲:

Controller Unit Test:
  Controller → UseCase(Mock) → Repository(Mock)
  検証: バインド、変換、エラーマッピング

Repository Integration Test:
  Repository → DB(Real)
  検証: SQL、DB制約

E2E Test:
  Controller → UseCase → Repository → DB
  検証: 全体の流れ

Controller Integration Test（不要）:
  Controller → UseCase → Repository → DB
  検証: ??? ← E2Eと同じ！
```

---

### Q2: Unit TestとIntegration Testの使い分けは？

**A: 「何を検証したいか」で決めます。**

```
ロジックを検証したい:
  → Unit Test（モック使用）
  → 速い、安定、デバッグしやすい

DBとの連携を検証したい:
  → Integration Test（testcontainers-go）
  → SQL、制約、トランザクション
```

---

### Q3: テストデータはどう用意する？

**A: 3つの方法があります。**

```
1. テスト内で作成（推奨）
   各テストで必要なデータをCREATE
   → テスト間の依存がない、わかりやすい

2. フィクスチャファイル
   tests/fixtures/seeds.sql を用意
   → 共通データを一括投入

3. ファクトリ関数
   testutil.CreateNote(t, repo, ...) のような関数
   → 再利用しやすい
```

---

### Q4: テストが遅いときはどうする？

**A: 以下を確認してください。**

```
1. testcontainersの再利用
   同じテストファイル内でコンテナを共有

2. 並列実行
   t.Parallel() を使用

3. -short フラグ
   Integration Testをスキップ

4. テストの粒度を見直す
   E2Eが多すぎないか確認
```

---

### Q5: モックとスタブの違いは？

**A:**

```
スタブ（Stub）:
  固定値を返すだけ
  「このメソッドが呼ばれたらこれを返す」

モック（Mock）:
  呼び出しを検証できる
  「このメソッドが1回呼ばれたか確認」
  「引数がこの値か確認」

このプロジェクトではgomockを使用:
  → スタブとしてもモックとしても使える
```

---

## 📁 ディレクトリ構成

```
backend-clean/
├─ internal/
│   ├─ domain/
│   │   └─ note/
│   │       ├─ entity.go
│   │       └─ entity_test.go              # Unit Test
│   │
│   ├─ usecase/
│   │   ├─ note_interactor.go
│   │   ├─ note_interactor_test.go         # Unit Test
│   │   └─ mock/                           # gomock生成
│   │
│   └─ adapter/
│       ├─ http/
│       │   ├─ controller/
│       │   │   ├─ note_controller.go
│       │   │   ├─ note_controller_test.go # Unit Test
│       │   │   └─ mock/
│       │   └─ presenter/
│       │       ├─ note_presenter.go
│       │       └─ note_presenter_test.go  # Unit Test
│       │
│       └─ gateway/
│           └─ db/
│               └─ sqlc/
│                   ├─ note_repository.go
│                   └─ note_repository_integration_test.go  # Integration
│
├─ tests/
│   ├─ e2e/
│   │   └─ note_api_test.go                # E2E Test
│   │
│   └─ testutil/
│       ├─ postgres.go                     # testcontainers-go
│       └─ server.go                       # テストサーバー
│
└─ migrations/                             # DBマイグレーション
```

---

## 🚀 次のステップ

1. **Unit Testを書いてみる**
   - Domain層のバリデーションから始める
   - テーブル駆動テストで書く

2. **Integration Testを書いてみる**
   - testcontainers-goでPostgreSQLを起動
   - RepositoryのCRUDをテスト

3. **E2E Testを書いてみる**
   - 主要なAPIフローをテスト
   - 認証→作成→取得→削除

**Happy Testing!** 🎉
