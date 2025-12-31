# CI/CD パイプラインガイド

> **このドキュメントのゴール**
> GitHub Actions を使った CI パイプラインの構成と、各ジョブの役割を理解する

---

## 目次

1. [パイプラインの概要](#パイプラインの概要)
2. [ジョブ構成](#ジョブ構成)
3. [実行フロー](#実行フロー)
4. [各ジョブの詳細](#各ジョブの詳細)
5. [トリガー条件](#トリガー条件)
6. [ローカルでの事前確認](#ローカルでの事前確認)

---

## パイプラインの概要

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Backend CI Pipeline                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   並列実行                                                                │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │     lint     │  │  unit-test   │  │    build     │                  │
│   │              │  │              │  │              │                  │
│   │ - Lint       │  │ - Unit Test  │  │ - Build      │                  │
│   │ - sqlc       │  │   (go test   │  │   (go build) │                  │
│   │   generate   │  │    -short)   │  │              │                  │
│   └──────────────┘  └──────┬───────┘  └──────────────┘                  │
│                            │                                             │
│                            │ needs: unit-test                            │
│                            ▼                                             │
│                   ┌──────────────────┐                                   │
│                   │ integration-test │                                   │
│                   │                  │                                   │
│                   │ - testcontainers │                                   │
│                   │ - PostgreSQL     │                                   │
│                   └────────┬─────────┘                                   │
│                            │                                             │
│                            │ needs: integration-test                     │
│                            ▼                                             │
│                   ┌──────────────────┐                                   │
│                   │     e2e-test     │                                   │
│                   │                  │                                   │
│                   │ - Full API Test  │                                   │
│                   │ - testcontainers │                                   │
│                   └──────────────────┘                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ジョブ構成

| ジョブ | 実行タイミング | 所要時間目安 | 役割 |
|--------|---------------|-------------|------|
| **lint** | 並列 | ~1分 | コード品質チェック + sqlc生成確認 |
| **unit-test** | 並列 | ~30秒 | ドメインロジック・UseCase のテスト |
| **build** | 並列 | ~30秒 | コンパイルエラーの検出 |
| **integration-test** | unit-test 後 | ~2分 | Repository 層のDBテスト |
| **e2e-test** | integration-test 後 | ~3分 | API 全体のテスト |

---

## 実行フロー

### なぜこの順序？

```
1. 並列実行（lint, unit-test, build）
   ┌────────────────────────────────────────────────────────────────┐
   │ これらは互いに依存しない                                        │
   │ - lint: コードスタイルのチェック                                │
   │ - unit-test: DBなしで高速に実行                                 │
   │ - build: コンパイルできるかの確認                               │
   │                                                                │
   │ → 並列で実行してCI時間を短縮                                    │
   └────────────────────────────────────────────────────────────────┘

2. integration-test（unit-test の後）
   ┌────────────────────────────────────────────────────────────────┐
   │ なぜ unit-test の後？                                          │
   │ - integration-test は testcontainers で PostgreSQL を起動      │
   │ - 時間がかかる（コンテナ起動 + マイグレーション）               │
   │ - unit-test で基本的なロジックエラーを先に検出                  │
   │                                                                │
   │ → 高速なテストで問題を早期発見し、遅いテストの無駄な実行を防ぐ  │
   └────────────────────────────────────────────────────────────────┘

3. e2e-test（integration-test の後）
   ┌────────────────────────────────────────────────────────────────┐
   │ なぜ integration-test の後？                                   │
   │ - e2e-test は最も重いテスト（API全体 + DB）                    │
   │ - Repository 層が壊れていたら e2e も失敗する                   │
   │ - integration-test で Repository 層を先に検証                  │
   │                                                                │
   │ → 段階的に検証し、問題の切り分けを容易にする                   │
   └────────────────────────────────────────────────────────────────┘
```

### テストピラミッドとの対応

```
                    ▲
                   /│\        e2e-test
                  / │ \       - 遅い、コスト高
                 /  │  \      - でも本番に近い
                /───┼───\
               /    │    \    integration-test
              /     │     \   - DB接続が必要
             /      │      \  - Repository層の検証
            /───────┼───────\
           /        │        \ unit-test
          /         │         \- 高速、大量に実行
         /          │          \- ドメインロジック検証
        ─────────────────────────

   下から順に実行 → 高速なテストで早期にエラー検出
```

---

## 各ジョブの詳細

### lint

```yaml
lint:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend-clean
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version: "1.25.1"
    - name: Install tools
      run: |
        go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0
        go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.63.4
    - name: Lint
      run: make lint
    - name: Generate sqlc
      run: make sqlc
```

**役割**:
- `make lint`: golangci-lint でコード品質をチェック
- `make sqlc`: sqlc generate で生成コードを更新し、差分がないか確認

**なぜ sqlc を lint で？**
```
開発者が sqlc generate を忘れて push → 生成コードと SQL が乖離
  ↓
CI で sqlc generate を実行 → 差分があればエラー
  ↓
「sqlc generate 忘れてるよ」と気づける
```

---

### unit-test

```yaml
unit-test:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend-clean
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version: "1.25.1"
    - name: Unit Test
      run: make test-unit
```

**役割**:
- `make test-unit` = `go test -short ./...`
- `-short` フラグで Integration/E2E テストをスキップ
- Domain層、UseCase層、Controller層のテストを実行

**対象**:
```
internal/domain/
├── note/logic_test.go
├── template/logic_test.go
├── account/logic_test.go
└── service/status_transition_test.go

internal/usecase/
├── note_interactor_test.go
├── template_interactor_test.go
└── account_interactor_test.go

internal/adapter/http/
├── controller/*_test.go
└── presenter/*_test.go
```

---

### build

```yaml
build:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend-clean
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version: "1.25.1"
    - name: Build
      run: make build
```

**役割**:
- `make build` = `go build ./...`
- コンパイルエラーがないか確認
- 型エラー、import エラーなどを検出

---

### integration-test

```yaml
integration-test:
  needs: unit-test
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend-clean
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version: "1.25.1"
    - name: Integration Test
      run: make test-integration
```

**役割**:
- `make test-integration` = `go test -tags=integration ./internal/adapter/gateway/...`
- testcontainers-go で PostgreSQL コンテナを起動
- Repository 層の CRUD 操作を検証

**対象**:
```
internal/adapter/gateway/db/
├── sqlc/
│   ├── note_repository_integration_test.go
│   ├── template_repository_integration_test.go
│   └── account_repository_integration_test.go
└── gorm/
    └── account_repository_integration_test.go
```

---

### e2e-test

```yaml
e2e-test:
  needs: integration-test
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend-clean
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version: "1.25.1"
    - name: E2E Test
      run: make test-e2e
```

**役割**:
- `make test-e2e` = `go test -tags=e2e ./tests/e2e/...`
- testcontainers-go で PostgreSQL コンテナを起動
- httptest.Server で API サーバーを起動
- HTTP リクエストで API 全体を検証

**対象**:
```
tests/e2e/
├── note_api_test.go
└── template_api_test.go
```

---

## トリガー条件

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "backend-clean/**"
      - ".github/workflows/backend-ci.yml"
  pull_request:
    branches:
      - main
    paths:
      - "backend-clean/**"
      - ".github/workflows/backend-ci.yml"
```

### いつ実行される？

| イベント | 条件 | 実行 |
|---------|------|------|
| main への push | backend-clean/** が変更 | Yes |
| main への push | frontend/** のみ変更 | No |
| main への PR | backend-clean/** が変更 | Yes |
| main への PR | docs/** のみ変更 | No |
| workflow ファイル変更 | - | Yes |

### なぜ paths フィルタ？

```
モノレポ構成:
├── backend-clean/    ← このCI
├── frontend/         ← 別のCI（将来）
├── api-schema/       ← 別のCI（将来）
└── docs/             ← CIなし

→ 関係ないファイルの変更で CI が回らないように
→ CI 時間の節約 + コスト削減
```

---

## ローカルでの事前確認

CI で失敗する前に、ローカルで確認しておくと効率的です。

```bash
# 1. Lint チェック
make lint

# 2. sqlc 生成（差分確認）
make sqlc
git diff --exit-code  # 差分があればエラー

# 3. Unit Test
make test-unit

# 4. Build
make build

# 5. Integration Test（Docker 必要）
make test-integration

# 6. E2E Test（Docker 必要）
make test-e2e

# 全部まとめて
make lint && make sqlc && make test-unit && make build && make test-integration && make test-e2e
```

---

## よくある質問

### Q: CI が遅いのですが、どうすれば？

```
現状の構成:
- lint, unit-test, build は並列（~1分）
- integration-test は unit-test 後（~2分）
- e2e-test は integration-test 後（~3分）
- 合計: ~6分

高速化のアイデア:
1. Go のキャッシュを有効化（actions/setup-go がやってくれる）
2. testcontainers のイメージをプルキャッシュ
3. integration-test と e2e-test を並列化（ただし問題切り分けが難しくなる）
```

### Q: testcontainers が CI で動かないのですが？

```
GitHub Actions の ubuntu-latest には Docker がプリインストールされています。
特別な設定なしで testcontainers-go は動作します。

もし動かない場合:
1. Docker サービスが起動しているか確認
2. testcontainers-go のバージョンを確認
3. PostgreSQL イメージが pull できるかネットワーク確認
```

### Q: lint で失敗したら unit-test は実行される？

```
はい、実行されます。
lint と unit-test は並列実行で、依存関係がありません。

失敗した場合:
- lint 失敗 → unit-test は実行される
- unit-test 失敗 → integration-test は実行されない（needs で依存）
- integration-test 失敗 → e2e-test は実行されない（needs で依存）
```

---

## 関連ドキュメント

- [06_testing_strategy.md](./06_testing_strategy.md) - テスト戦略の詳細
- [07_test_cases.md](./07_test_cases.md) - テストケース一覧
- [05_local_setup.md](./05_local_setup.md) - ローカル環境セットアップ
