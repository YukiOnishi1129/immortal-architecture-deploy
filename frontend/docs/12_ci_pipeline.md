# CI パイプラインガイド

> **このドキュメントのゴール**
> GitHub Actions を使った CI パイプラインの構成と、各ステップの役割を理解する

---

## 目次

1. [パイプラインの概要](#パイプラインの概要)
2. [ステップ構成](#ステップ構成)
3. [実行フロー](#実行フロー)
4. [各ステップの詳細](#各ステップの詳細)
5. [トリガー条件](#トリガー条件)
6. [ローカルでの事前確認](#ローカルでの事前確認)

---

## パイプラインの概要

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Frontend CI Pipeline                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   順次実行（シングルジョブ構成）                                           │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  1. Checkout & Setup                                          │      │
│   │     - リポジトリのチェックアウト                                │      │
│   │     - Node.js 20 セットアップ                                  │      │
│   │     - pnpm セットアップ & キャッシュ                           │      │
│   │     - 依存関係インストール                                      │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  2. Lint                                                      │      │
│   │     - Biome によるコード品質チェック                           │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  3. Unit Test                                                 │      │
│   │     - Vitest によるユニットテスト                              │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  4. Install Playwright Browsers                               │      │
│   │     - Chromium ブラウザのインストール                          │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  5. Build                                                     │      │
│   │     - Next.js アプリケーションのビルド                         │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  6. E2E Test                                                  │      │
│   │     - Playwright による E2E テスト                            │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼ (失敗時のみ)                              │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  7. Upload Playwright Report                                  │      │
│   │     - テストレポートのアーティファクト保存                      │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ステップ構成

| ステップ             | 所要時間目安 | 役割                                               |
| -------------------- | ------------ | -------------------------------------------------- |
| **Setup**            | ~1 分        | Node.js、pnpm のセットアップと依存関係インストール |
| **Lint**             | ~30 秒       | Biome によるコード品質チェック                     |
| **Unit Test**        | ~30 秒       | Vitest によるユニットテスト                        |
| **Install Browsers** | ~1 分        | Playwright ブラウザのインストール                  |
| **Build**            | ~1 分        | Next.js アプリケーションのビルド                   |
| **E2E Test**         | ~2 分        | Playwright による E2E テスト                       |

---

## 実行フロー

### なぜシングルジョブ構成？

```
フロントエンドCIの特徴:
┌────────────────────────────────────────────────────────────────┐
│ - 依存関係のインストールが重い（node_modules）                   │
│ - ビルド成果物を E2E テストで使い回す                           │
│ - ジョブを分けるとセットアップのオーバーヘッドが大きい            │
│                                                                │
│ → シングルジョブで順次実行し、セットアップコストを最小化          │
└────────────────────────────────────────────────────────────────┘
```

### テストの順序

```
1. Lint（静的解析）
   ┌────────────────────────────────────────────────────────────────┐
   │ - 最も高速に実行できる                                         │
   │ - コードスタイルの問題を早期に検出                              │
   │ - ビルド前に問題を発見                                         │
   └────────────────────────────────────────────────────────────────┘

2. Unit Test
   ┌────────────────────────────────────────────────────────────────┐
   │ - ブラウザ不要で高速                                          │
   │ - ロジックのバグを早期に検出                                   │
   │ - E2E テストより先に基本的な問題を発見                         │
   └────────────────────────────────────────────────────────────────┘

3. Build
   ┌────────────────────────────────────────────────────────────────┐
   │ - TypeScript の型エラーを検出                                  │
   │ - ビルド成果物を E2E テストで使用                              │
   │ - 本番環境と同じビルドプロセスを検証                           │
   └────────────────────────────────────────────────────────────────┘

4. E2E Test
   ┌────────────────────────────────────────────────────────────────┐
   │ - 最も時間がかかる                                            │
   │ - ビルド成果物を使って実際のブラウザで検証                     │
   │ - ユーザー視点での動作確認                                     │
   └────────────────────────────────────────────────────────────────┘
```

### テストピラミッドとの対応

```
                    ▲
                   /│\        E2E Test (Playwright)
                  / │ \       - 遅い、コスト高
                 /  │  \      - でもユーザー視点で検証
                /───┼───\
               /    │    \    Unit Test (Vitest)
              /     │     \   - 高速、大量に実行
             /      │      \  - ロジック検証
            ─────────────────────

   下から順に実行 → 高速なテストで早期にエラー検出
```

---

## 各ステップの詳細

### Setup（環境構築）

```yaml
steps:
  - name: Checkout repository
    uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: "20"

  - name: Setup pnpm
    uses: pnpm/action-setup@v2
    with:
      version: "9"

  - name: Get pnpm store directory
    id: pnpm-cache
    shell: bash
    run: |
      echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT
    working-directory: frontend

  - name: Setup pnpm cache
    uses: actions/cache@v3
    with:
      path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
      key: ${{ runner.os }}-pnpm-store-${{ hashFiles('frontend/pnpm-lock.yaml') }}
      restore-keys: |
        ${{ runner.os }}-pnpm-store-

  - name: Install dependencies
    run: pnpm install
    working-directory: frontend
```

**役割**:

- Node.js 20、pnpm 9 をセットアップ
- pnpm ストアをキャッシュして CI を高速化
- 依存関係をインストール

**なぜ pnpm？**

```
npm vs pnpm:
- pnpm は依存関係を効率的にキャッシュ
- ディスク容量を節約
- インストール時間を短縮

キャッシュの仕組み:
1. pnpm-lock.yaml のハッシュをキーに使用
2. ロックファイルが同じ → キャッシュヒット → 高速インストール
3. ロックファイルが変わった → キャッシュミス → フルインストール
```

---

### Lint

```yaml
- name: Lint
  run: pnpm lint
  working-directory: frontend
```

**役割**:

- `pnpm lint` = `biome check`
- コードスタイル、フォーマット、潜在的なバグをチェック
- ESLint + Prettier の代わりに Biome を使用

**なぜ Biome？**

```
Biome の特徴:
- Rust 製で高速
- ESLint + Prettier を1つのツールで代替
- 設定がシンプル
- 一貫したコードスタイルを強制
```

---

### Unit Test

```yaml
- name: Unit Test
  run: pnpm test
  working-directory: frontend
```

**役割**:

- `pnpm test` = `vitest run`
- コンポーネント、フック、ユーティリティのテスト
- jsdom 環境でブラウザをシミュレート

**対象**:

```
src/
├── features/
│   ├── note/
│   │   └── components/__tests__/
│   ├── template/
│   │   └── components/__tests__/
│   └── ...
└── ...
```

---

### Install Playwright Browsers

```yaml
- name: Install Playwright Browsers
  run: pnpm exec playwright install --with-deps chromium
  working-directory: frontend
```

**役割**:

- E2E テスト用の Chromium ブラウザをインストール
- `--with-deps` でシステム依存関係も一緒にインストール
- Chromium のみインストール（Firefox、WebKit は省略して高速化）

**なぜ Chromium のみ？**

```
CI の高速化:
- 全ブラウザをインストールすると時間がかかる
- Chromium は最も広く使われるブラウザエンジン
- クロスブラウザテストはローカルで実行可能
```

---

### Build

```yaml
- name: Build
  run: pnpm build
  working-directory: frontend
  env:
    DATABASE_URL: postgresql://user:password@localhost:5432/test
    NEXT_PUBLIC_APP_URL: http://localhost:3000
    GOOGLE_CLIENT_ID: test-client-id
    GOOGLE_CLIENT_SECRET: test-client-secret
```

**役割**:

- `pnpm build` = `next build`
- TypeScript のコンパイルエラーを検出
- 本番用のビルド成果物を生成
- E2E テストで使用するビルド成果物を作成

**環境変数について**:

```
CI 用のダミー環境変数:
- DATABASE_URL: ビルド時に必要（実際の接続はしない）
- NEXT_PUBLIC_APP_URL: クライアントサイドで使用するURL
- GOOGLE_CLIENT_ID/SECRET: 認証設定（CI では使用しない）

→ ビルドを通すための最小限の設定
```

---

### E2E Test

```yaml
- name: E2E Test
  run: pnpm test:e2e
  working-directory: frontend
  env:
    CI: true
    DATABASE_URL: postgresql://user:password@localhost:5432/test
    NEXT_PUBLIC_APP_URL: http://localhost:3000
    GOOGLE_CLIENT_ID: test-client-id
    GOOGLE_CLIENT_SECRET: test-client-secret
```

**役割**:

- `pnpm test:e2e` = `playwright test`
- 実際のブラウザでアプリケーションを起動してテスト
- ユーザーの操作をシミュレート

**対象**:

```
e2e/
├── note.spec.ts
├── template.spec.ts
└── ...
```

---

### Upload Playwright Report

```yaml
- name: Upload Playwright Report
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: frontend/playwright-report/
    retention-days: 30
```

**役割**:

- E2E テストが失敗した場合のみ実行
- テストレポートをアーティファクトとして保存
- スクリーンショット、トレース、ログを含む
- 30 日間保持

**失敗時のデバッグ方法**:

```
1. GitHub Actions の Summary からアーティファクトをダウンロード
2. playwright-report フォルダを解凍
3. index.html をブラウザで開く
4. 失敗したテストのスクリーンショット、トレースを確認
```

---

## トリガー条件

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"
  pull_request:
    branches:
      - main
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"
```

### いつ実行される？

| イベント              | 条件                        | 実行 |
| --------------------- | --------------------------- | ---- |
| main への push        | frontend/\*\* が変更        | Yes  |
| main への push        | backend-clean/\*\* のみ変更 | No   |
| main への PR          | frontend/\*\* が変更        | Yes  |
| main への PR          | docs/\*\* のみ変更          | No   |
| workflow ファイル変更 | -                           | Yes  |

### なぜ paths フィルタ？

```
モノレポ構成:
├── backend-clean/    ← 別のCI
├── frontend/         ← このCI
├── api-schema/       ← 別のCI（将来）
└── docs/             ← CIなし

→ 関係ないファイルの変更で CI が回らないように
→ CI 時間の節約 + コスト削減
```

---

## ローカルでの事前確認

CI で失敗する前に、ローカルで確認しておくと効率的です。

```bash
# frontend ディレクトリに移動
cd frontend

# 1. Lint チェック
pnpm lint

# 2. Unit Test
pnpm test

# 3. Build
pnpm build

# 4. E2E Test（ブラウザインストール済みの場合）
pnpm test:e2e

# 5. E2E Test（UI モードでデバッグ）
pnpm test:e2e:ui

# 全部まとめて
pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

---

## よくある質問

### Q: CI が遅いのですが、どうすれば？

```
現状の構成:
- Setup: ~1分（pnpm キャッシュで短縮）
- Lint: ~30秒
- Unit Test: ~30秒
- Browser Install: ~1分
- Build: ~1分
- E2E Test: ~2分
- 合計: ~6分

高速化のアイデア:
1. pnpm キャッシュを活用（既に実装済み）
2. Playwright ブラウザをキャッシュ
3. E2E テストを並列実行（Playwright の sharding）
4. ビルドキャッシュを有効化
```

### Q: E2E テストが CI で失敗するのですが？

```
よくある原因:
1. 環境変数の設定漏れ
   → workflow ファイルの env セクションを確認

2. タイムアウト
   → CI 環境は遅いので、タイムアウト値を調整

3. ブラウザの問題
   → playwright install --with-deps を確認

4. ビルドの問題
   → ローカルで pnpm build が通るか確認

デバッグ方法:
1. Playwright Report をダウンロード
2. スクリーンショットを確認
3. トレースを再生
```

### Q: Lint で失敗したらテストは実行される？

```
いいえ、実行されません。
シングルジョブ構成なので、前のステップが失敗すると後続は実行されません。

失敗した場合:
- Lint 失敗 → Unit Test は実行されない
- Unit Test 失敗 → Build は実行されない
- Build 失敗 → E2E Test は実行されない

→ 早期に失敗して CI 時間を節約
```

---

## 関連ドキュメント

- [09_testing_strategy.md](./09_testing_strategy.md) - テスト戦略の詳細
- [10_bff_testing_strategy.md](./10_bff_testing_strategy.md) - BFF テスト戦略
- [11_e2e_test_design.md](./11_e2e_test_design.md) - E2E テスト設計
- [07_development_guide.md](./07_development_guide.md) - 開発ガイド
