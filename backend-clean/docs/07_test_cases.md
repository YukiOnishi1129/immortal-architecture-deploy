# テストケース一覧

> **このドキュメントのゴール**
> 実装済みのテストケースを一覧化し、「何を」「なぜ」テストしているかを明確にする

---

## 目次

1. [テスト構成の概要](#テスト構成の概要)
2. [Unit Test - C1カバレッジマトリックス](#unit-test---c1カバレッジマトリックス)
3. [Integration Test - Repository層](#integration-test---repository層)
4. [E2E Test - API全体](#e2e-test---api全体)
5. [テストの実行方法](#テストの実行方法)

---

## テスト構成の概要

```
tests/
├── testutil/                    # 共通テストユーティリティ
│   ├── postgres.go              # PostgreSQLコンテナ管理
│   └── fixtures.go              # テストデータ生成
│
├── e2e/                         # E2Eテスト
│   ├── testutil/
│   │   └── server.go            # テストサーバー起動
│   ├── note_api_test.go         # Note API テスト
│   └── template_api_test.go     # Template API テスト
│
internal/adapter/gateway/db/
├── sqlc/
│   ├── note_repository_integration_test.go
│   ├── template_repository_integration_test.go
│   └── account_repository_integration_test.go
│
└── gorm/
    └── account_repository_integration_test.go

internal/domain/
├── note/
│   ├── logic_test.go              # Note ドメインロジック
│   └── aggregate_test.go          # Note 集約ルート
├── template/
│   ├── logic_test.go              # Template ドメインロジック
│   └── aggregate_test.go          # Template 集約ルート
├── account/
│   ├── logic_test.go              # Account ドメインロジック
│   └── vo_test.go                 # ValueObject
└── service/
    └── status_transition_test.go  # 状態遷移サービス

internal/usecase/
├── note_interactor_test.go        # Note ユースケース
├── template_interactor_test.go    # Template ユースケース
├── account_interactor_test.go     # Account ユースケース
└── helpers_test.go                # ヘルパー関数

internal/adapter/http/
├── controller/
│   ├── note_controller_test.go    # Note コントローラー
│   ├── template_controller_test.go # Template コントローラー
│   └── account_controller_test.go # Account コントローラー
└── presenter/
    ├── note_presenter_test.go     # Note プレゼンター
    └── template_presenter_test.go # Template プレゼンター
```

---

## Unit Test - C1カバレッジマトリックス

> **C1カバレッジ（Branch Coverage）とは？**
> すべての条件分岐（if文、switch文など）のTrue/False両方のパスを通過するテストケースを用意すること。

### Domain層 - Note

**ファイル**: `internal/domain/note/logic_test.go`

#### ValidateNoteOwnership

| 条件 | True パス | False パス |
|------|----------|-----------|
| `ownerID == ""` | `[Fail] missing owner` → `ErrOwnerRequired` | - |
| `actorID == ""` | `[Fail] missing actor` → `ErrOwnerRequired` | - |
| `ownerID == actorID` | `[Success] owner matches` | `[Fail] owner mismatch` → `ErrUnauthorized` |

#### CanChangeStatus

| 条件 | True パス | False パス |
|------|----------|-----------|
| `from` が有効なステータス | `[Success] draft to publish`, `[Success] publish to draft` | `[Fail] invalid transition` → `ErrInvalidStatusChange` |
| `from == to` | `[Success] no change` | - |

#### ValidateSections

| 条件 | True パス | False パス |
|------|----------|-----------|
| セクション数 == フィールド数 | `[Success] valid sections` | `[Fail] missing template field` → `ErrSectionsMissing` |
| 重複フィールドあり | - | `[Fail] duplicate field` → `ErrSectionsMissing` |
| 必須フィールドが空 | - | `[Fail] required field empty` → `ErrRequiredFieldEmpty` |

#### ValidateNoteForCreate

| 条件 | True パス | False パス |
|------|----------|-----------|
| `title` が空でない | `[Success] valid` | `[Fail] empty title` → `ErrTitleRequired` |
| `template.OwnerID` が空でない | `[Success] valid` | `[Fail] missing template owner` → `ErrOwnerRequired` |
| セクション検証OK | `[Success] valid` | `[Fail] sections invalid` → `ErrRequiredFieldEmpty` |

---

### Domain層 - Account

**ファイル**: `internal/domain/account/logic_test.go`

#### ParseEmail

| 条件 | True パス | False パス |
|------|----------|-----------|
| `@` を含む | `[Success] valid email` | `[Fail] missing at` → `ErrInvalidEmail` |
| 空文字でない | `[Success] valid email` | `[Fail] empty` → `ErrInvalidEmail` |

#### Validate

| 条件 | True パス | False パス |
|------|----------|-----------|
| 名前が空でない | `[Success] valid account` | `[Fail] missing name` → `ErrInvalidName` |
| `Provider` が空でない | `[Success] valid account` | `[Fail] missing provider` → `ErrProviderRequired` |
| `ProviderAccountID` が空でない | `[Success] valid account` | `[Fail] missing provider account` → `ErrProviderAccountRequired` |

#### UpdateProfile

| 条件 | True パス | False パス |
|------|----------|-----------|
| メールが有効 | `[Success] merge fields` | `[Fail] invalid email` → `ErrInvalidEmail` |
| サムネイルがnilでない | `[Success] merge fields` → サムネイル更新 | - |

---

### Domain層 - Template

**ファイル**: `internal/domain/template/logic_test.go`

#### NormalizeAndValidate

| 条件 | True パス | False パス |
|------|----------|-----------|
| フィールドが空でない | `[Success] fills order when zero` | `[Fail] empty fields` → `ErrFieldRequired` |
| ラベルが空でない | `[Success] fills order when zero` | `[Fail] missing label` → `ErrFieldLabelRequired` |
| 順序が重複しない | `[Success] fills order when zero` | `[Fail] duplicate order` → `ErrFieldOrderInvalid` |

#### ValidateTemplate

| 条件 | True パス | False パス |
|------|----------|-----------|
| 名前が空でない | `[Success] valid template` | `[Fail] missing name` → `ErrTemplateNameRequired` |
| オーナーが空でない | `[Success] valid template` | `[Fail] missing owner` → `ErrTemplateOwnerRequired` |
| フィールド検証OK | `[Success] valid template` | `[Fail] invalid fields` → `ErrFieldOrderInvalid` |

#### CanDeleteTemplate

| 条件 | True パス | False パス |
|------|----------|-----------|
| `isUsed == false` | `[Success] not used` | `[Fail] used` → `ErrTemplateInUse` |

#### ValidateTemplateOwnership

| 条件 | True パス | False パス |
|------|----------|-----------|
| `ownerID` が空でない | - | `[Fail] empty owner`, `[Fail] whitespace owner` → `ErrTemplateOwnerRequired` |
| `actorID` が空でない | - | `[Fail] empty actor` → `ErrTemplateOwnerRequired` |
| `ownerID == actorID` | `[Success] owner matches` | `[Fail] owner mismatch` → `ErrUnauthorized` |

---

### Domain層 - Service

**ファイル**: `internal/domain/service/status_transition_test.go`

#### CanPublish

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーが一致 | `[Success] owner can publish draft` | `[Fail] unauthorized actor` → `ErrUnauthorized` |
| ステータスが有効 | `[Success] owner can publish draft` | `[Fail] invalid status value` → `ErrInvalidStatus` |

#### CanUnpublish

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーが一致 | `[Success] owner can unpublish publish` | `[Fail] unauthorized actor` → `ErrUnauthorized` |
| ステータスが有効 | `[Success] owner can unpublish publish` | `[Fail] invalid status value` → `ErrInvalidStatus` |

---

### UseCase層 - NoteInteractor

**ファイル**: `internal/usecase/note_interactor_test.go`

#### List

| 条件 | True パス | False パス |
|------|----------|-----------|
| リポジトリ成功 | `[Success] list notes` | `[Fail] repo error` |

#### Get

| 条件 | True パス | False パス |
|------|----------|-----------|
| ノートが存在 | `[Success] get note` | `[Fail] not found` → `ErrNotFound` |

#### Create

| 条件 | True パス | False パス |
|------|----------|-----------|
| テンプレート取得成功 | `[Success] create with sections` | `[Fail] template get error` |
| セクションあり | `[Success] create with sections` | `[Fail] sections missing` → `ErrSectionsMissing` |
| バリデーション成功 | `[Success] create with sections` | `[Fail] validation error` → `ErrTitleRequired` |
| Create成功 | `[Success] create with sections` | `[Fail] create error` |
| ReplaceSections成功 | `[Success] create with sections` | `[Fail] replace sections error` |

#### Update

| 条件 | True パス | False パス |
|------|----------|-----------|
| ノート取得成功 | `[Success] update title only` | `[Fail] get error` |
| オーナー一致 | `[Success] update title only` | `[Fail] owner mismatch` → `ErrUnauthorized` |
| タイトルが空でない | `[Success] update title only` | `[Fail] empty title` → `ErrTitleRequired` |
| Update成功 | `[Success] update title only` | `[Fail] update error` |
| セクション更新時 | `[Success] update sections` | `[Fail] replace sections error` |

#### ChangeStatus

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナー一致 | `[Success] publish` | `[Fail] owner mismatch` → `ErrUnauthorized` |
| ステータスが有効 | `[Success] publish` | `[Fail] invalid status` → `ErrInvalidStatus` |
| UpdateStatus成功 | `[Success] publish` | `[Fail] update status error` |

#### Delete

| 条件 | True パス | False パス |
|------|----------|-----------|
| ノート取得成功 | `[Success] delete` | `[Fail] get error` |
| オーナー一致 | `[Success] delete` | `[Fail] owner mismatch` → `ErrUnauthorized` |
| Delete成功 | `[Success] delete` | `[Fail] delete error` |

---

### UseCase層 - TemplateInteractor

**ファイル**: `internal/usecase/template_interactor_test.go`

#### Create

| 条件 | True パス | False パス |
|------|----------|-----------|
| バリデーション成功 | `[Success] create with fields` | `[Fail] validation error` → `ErrTemplateNameRequired` |
| リポジトリ成功 | `[Success] create with fields` | `[Fail] repo create error` |

#### List

| 条件 | True パス | False パス |
|------|----------|-----------|
| リポジトリ成功 | `[Success] list templates` | `[Fail] repo error` |

#### Get

| 条件 | True パス | False パス |
|------|----------|-----------|
| テンプレートが存在 | `[Success] get template` | `[Fail] not found` → `ErrNotFound` |

#### Update

| 条件 | True パス | False パス |
|------|----------|-----------|
| テンプレート取得成功 | `[Success] update name and fields` | `[Fail] repo get error` |
| オーナー必須 | `[Success] update name and fields` | `[Fail] owner required` → `ErrTemplateOwnerRequired` |
| フィールド検証成功 | `[Success] update name and fields` | `[Fail] validate fields` → `ErrFieldRequired` |
| Update成功 | `[Success] update name and fields` | `[Fail] update error` |
| ReplaceFields成功 | `[Success] update name and fields` | `[Fail] replace fields error` |

#### Delete

| 条件 | True パス | False パス |
|------|----------|-----------|
| テンプレート取得成功 | `[Success] delete` | `[Fail] get error` |
| オーナー必須 | `[Success] delete` | `[Fail] owner required` → `ErrTemplateOwnerRequired` |
| 未使用状態 | `[Success] delete` | `[Fail] in use` → `ErrTemplateInUse` |
| Delete成功 | `[Success] delete` | `[Fail] delete error` |

---

### Controller層 - NoteController

**ファイル**: `internal/adapter/http/controller/note_controller_test.go`

#### Create

| 条件 | True パス | False パス |
|------|----------|-----------|
| ボディ解析成功 | `[Success] create note` → 200 | `[Fail] bind error` → 400 |

#### List

| 条件 | True パス | False パス |
|------|----------|-----------|
| UseCase成功 | `[Success] list notes` → 200 | `[Fail] repo error` → 404 |

#### Get

| 条件 | True パス | False パス |
|------|----------|-----------|
| UseCase成功 | `[Success] get note` → 200 | `[Fail] not found` → 404 |

#### Update

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーあり | `[Success] update note` → 200 | `[Fail] missing owner` → 403 |

#### Publish

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーあり | `[Success] publish note` → 200 | `[Fail] publish missing owner` → 500 |
| UseCase成功 | `[Success] publish note` → 200 | `[Fail] publish forbidden` → 403 |

#### Unpublish

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーあり | `[Success] unpublish note` → 200 | `[Fail] unpublish missing owner` → 500 |
| UseCase成功 | `[Success] unpublish note` → 200 | `[Fail] unpublish forbidden` → 403, `[Fail] unpublish not found` → 404 |

#### Delete

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーあり | `[Success] delete` → 200 | `[Fail] owner missing` → 403 |
| UseCase成功 | `[Success] delete` → 200 | `[Fail] not found` → 404 |

---

### Controller層 - TemplateController

**ファイル**: `internal/adapter/http/controller/template_controller_test.go`

#### Create

| 条件 | True パス | False パス |
|------|----------|-----------|
| ボディ解析成功 | `[Success] create template` → 200 | `[Fail] bind error` → 400 |

#### List

| 条件 | True パス | False パス |
|------|----------|-----------|
| UseCase成功 | `[Success] list templates` → 200 | `[Fail] repo error` → 404 |

#### Get

| 条件 | True パス | False パス |
|------|----------|-----------|
| UseCase成功 | `[Success] get template` → 200 | `[Fail] not found` → 404 |

#### Update

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーあり | `[Success] update template` → 200 | `[Fail] missing owner` → 403 |
| UseCase成功 | `[Success] update template` → 200 | `[Fail] usecase error` → 404 |

#### Delete

| 条件 | True パス | False パス |
|------|----------|-----------|
| オーナーあり | `[Success] delete template` → 200 | `[Fail] owner missing` → 403 |
| UseCase成功 | `[Success] delete template` → 200 | `[Fail] not found` → 404 |

---

### Presenter層

**ファイル**: `internal/adapter/http/presenter/note_presenter_test.go`, `template_presenter_test.go`

#### NotePresenter

| メソッド | テストケース | 検証内容 |
|---------|-------------|---------|
| `PresentNote` | `[Success] single note` | 全フィールドが変換されること |
| `PresentNoteList` | `[Success] list` | リスト件数が正しいこと |
| `PresentNoteDeleted` | - | `success=true` が返ること |

#### TemplatePresenter

| メソッド | テストケース | 検証内容 |
|---------|-------------|---------|
| `PresentTemplate` | `[Success] single` | 全フィールド（isUsed, owner情報含む）が変換されること |
| `PresentTemplateList` | `[Success] list` | リスト件数が正しいこと |
| `PresentTemplateDeleted` | - | `success=true` が返ること |

---

## Integration Test - Repository層

### テストの観点

| 観点 | 説明 | 重要度 |
|------|------|--------|
| **CRUD操作** | Create/Read/Update/Deleteが正しく動作するか | 必須 |
| **フィルタリング** | 検索条件（status, ownerIdなど）が正しく動作するか | 必須 |
| **DB制約** | UNIQUE制約、FK制約が正しく機能するか | 必須 |
| **エラーハンドリング** | 存在しないレコードへのアクセスで適切なエラーが返るか | 必須 |
| **関連データ** | 関連テーブル（Sections, Fields）が正しく保存・取得されるか | 重要 |

---

### NoteRepository Integration Test

**ファイル**: `internal/adapter/gateway/db/sqlc/note_repository_integration_test.go`

#### CRUD操作テスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Create note` | 作成 | ノートを作成し、IDが生成され、各フィールドが正しく保存されること |
| `Get note` | 取得 | 作成したノートをIDで取得し、全フィールドが一致すること |
| `Get note with meta` | 取得 | テンプレート名・オーナー名などのメタ情報も取得できること |
| `Update note` | 更新 | タイトル変更後、変更が反映され、UpdatedAtが更新されること |
| `Delete note` | 削除 | 削除後、Getで`ErrNotFound`が返ること |

#### フィルタリングテスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `List by status` | ステータスフィルタ | `status=Draft`で下書きのみ、`status=Publish`で公開済みのみ返ること |
| `List by owner` | オーナーフィルタ | `ownerId`指定で該当オーナーのノートのみ返ること |
| `List by template` | テンプレートフィルタ | `templateId`指定で該当テンプレートのノートのみ返ること |
| `Search by query` | キーワード検索 | `q`パラメータでタイトル部分一致検索ができること |

#### セクション関連テスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Create with sections` | セクション作成 | ノート作成時にセクションも同時に作成されること |
| `Update sections` | セクション更新 | セクションのcontentを更新できること |
| `Get note includes sections` | セクション取得 | ノート取得時にセクションも含まれること |

#### エラーハンドリングテスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Get non-existent note` | 存在しないID | `ErrNotFound`が返ること |
| `Update non-existent note` | 存在しないID | `ErrNotFound`が返ること |
| `Delete non-existent note` | 存在しないID | `ErrNotFound`が返ること |

#### DB制約テスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `FK constraint - template` | 外部キー制約 | 存在しないtemplateIdでノート作成するとエラー |
| `FK constraint - owner` | 外部キー制約 | 存在しないownerIdでノート作成するとエラー |

---

### TemplateRepository Integration Test

**ファイル**: `internal/adapter/gateway/db/sqlc/template_repository_integration_test.go`

#### CRUD操作テスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Create template` | 作成 | テンプレートを作成し、IDが生成されること |
| `Create with fields` | フィールド付き作成 | テンプレートとフィールドが同時に作成されること |
| `Get template` | 取得 | テンプレートとフィールドを取得できること |
| `Update template` | 更新 | 名前変更が反映されること |
| `Update fields` | フィールド更新 | フィールドの追加・削除・更新ができること |
| `Delete template` | 削除 | 削除後、`ErrNotFound`が返ること |

#### フィルタリングテスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `List by owner` | オーナーフィルタ | `ownerId`指定で該当オーナーのテンプレートのみ返ること |
| `Search by query` | キーワード検索 | `q`パラメータで名前部分一致検索ができること |

#### isUsedフラグテスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `isUsed = false` | 未使用状態 | ノートが紐づいていないテンプレートは`isUsed=false` |
| `isUsed = true` | 使用中状態 | ノートが紐づいているテンプレートは`isUsed=true` |

#### エラーハンドリングテスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Get non-existent template` | 存在しないID | `ErrNotFound`が返ること |

---

### AccountRepository Integration Test

**ファイル**: `internal/adapter/gateway/db/sqlc/account_repository_integration_test.go`

#### CRUD操作テスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Create new account` | 新規作成 | OAuthアカウントを作成し、IDが生成されること |
| `Upsert existing account` | 更新（同じprovider+providerAccountId） | 既存アカウントが更新されること |
| `Create with thumbnail` | サムネイル付き | thumbnailが保存されること |
| `GetByID` | ID検索 | IDで正しいアカウントが取得できること |
| `GetByEmail` | メール検索 | メールで正しいアカウントが取得できること |

#### DB制約テスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `Email uniqueness` | UNIQUE制約 | 同じメールで別provider+providerAccountIdは制約違反 |
| `Provider account uniqueness` | UPSERT動作 | 同じprovider+providerAccountIdは更新される |

#### エラーハンドリングテスト

| テストケース | 観点 | 検証内容 |
|-------------|------|---------|
| `GetByID non-existent` | 存在しないID | `ErrNotFound`が返ること |
| `GetByEmail non-existent` | 存在しないメール | `ErrNotFound`が返ること |

---

### AccountRepository (GORM) Integration Test

**ファイル**: `internal/adapter/gateway/db/gorm/account_repository_integration_test.go`

sqlc版と同じテストケースをGORM実装で検証。ORM間の動作差異がないことを確認。

---

## E2E Test - API全体

### テストの観点

| 観点 | 説明 | 重要度 |
|------|------|--------|
| **CRUDフロー** | 作成→取得→更新→削除の一連の流れが動作するか | 必須 |
| **ステータス変更** | Publish/Unpublishなどの状態遷移が正しいか | 必須 |
| **エラーレスポンス** | 不正なリクエストで適切なHTTPステータスが返るか | 必須 |
| **認可** | 他人のリソースにアクセスできないか | 必須 |
| **フィルタリング** | クエリパラメータによる絞り込みが動作するか | 重要 |

---

### Note API E2E Test

**ファイル**: `tests/e2e/note_api_test.go`

#### CRUDテスト (`TestNoteAPI_CRUD`)

| テストケース | エンドポイント | 検証内容 |
|-------------|---------------|---------|
| `POST /api/notes - Create` | POST /api/notes | ノート作成、status=Draft、セクション3つ |
| `GET /api/notes/:id - Get` | GET /api/notes/:id | ノート取得、templateName含む |
| `GET /api/notes - List` | GET /api/notes | 一覧取得、1件以上存在 |
| `PUT /api/notes/:id - Update` | PUT /api/notes/:id | タイトル・セクション更新 |
| `POST /api/notes/:id/publish` | POST /api/notes/:id/publish | status=Publishに変更 |
| `POST /api/notes/:id/unpublish` | POST /api/notes/:id/unpublish | status=Draftに戻る |
| `DELETE /api/notes/:id - Delete` | DELETE /api/notes/:id | 削除後GETで404 |

#### エラーテスト (`TestNoteAPI_Errors`)

| テストケース | エンドポイント | 期待するステータス | 検証内容 |
|-------------|---------------|------------------|---------|
| `GET - Not found` | GET /api/notes/:id | 404 Not Found | 存在しないIDでアクセス |
| `POST - Invalid body` | POST /api/notes | 400 Bad Request | 不正なJSONボディ |
| `PUT - Missing ownerId` | PUT /api/notes/:id | 400 Bad Request | ownerIdパラメータなし |
| `DELETE - Wrong owner` | DELETE /api/notes/:id | 403 Forbidden | 他人のノートを削除しようとする |

#### フィルタリングテスト (`TestNoteAPI_Filters`)

| テストケース | クエリパラメータ | 検証内容 |
|-------------|-----------------|---------|
| `Filter by status=Draft` | ?status=Draft | Draftのノートのみ返る |
| `Filter by status=Publish` | ?status=Publish | Publishのノートのみ返る |
| `Filter by ownerId` | ?ownerId=xxx | 該当オーナーのノートのみ返る |
| `Search by query` | ?q=Published | タイトル部分一致 |

---

### Template API E2E Test

**ファイル**: `tests/e2e/template_api_test.go`

#### CRUDテスト (`TestTemplateAPI_CRUD`)

| テストケース | エンドポイント | 検証内容 |
|-------------|---------------|---------|
| `POST /api/templates - Create` | POST /api/templates | テンプレート作成、フィールド3つ |
| `GET /api/templates/:id - Get` | GET /api/templates/:id | テンプレート取得、isUsed=false、owner情報含む |
| `GET /api/templates - List` | GET /api/templates | 一覧取得、1件以上存在 |
| `PUT /api/templates/:id - Update` | PUT /api/templates/:id | 名前変更、フィールド数変更 |
| `DELETE /api/templates/:id - Delete` | DELETE /api/templates/:id | 削除後GETで404 |

#### エラーテスト (`TestTemplateAPI_Errors`)

| テストケース | エンドポイント | 期待するステータス | 検証内容 |
|-------------|---------------|------------------|---------|
| `GET - Not found` | GET /api/templates/:id | 404 Not Found | 存在しないIDでアクセス |
| `POST - Invalid body` | POST /api/templates | 400 Bad Request | 不正なJSONボディ |
| `PUT - Missing ownerId` | PUT /api/templates/:id | 400 Bad Request | ownerIdパラメータなし |
| `DELETE - Wrong owner` | DELETE /api/templates/:id | 403 Forbidden | 他人のテンプレートを削除 |

#### フィルタリングテスト (`TestTemplateAPI_Filters`)

| テストケース | クエリパラメータ | 検証内容 |
|-------------|-----------------|---------|
| `Filter by ownerId` | ?ownerId=xxx | 該当オーナーのテンプレートのみ返る |
| `Search by query` | ?q=Design | 名前部分一致 |

---

## テストの実行方法

### コマンド一覧

```bash
# Unit Test（Docker不要、高速）
make test-unit

# Integration Test（Docker必須）
make test-integration

# E2E Test（Docker必須）
make test-e2e

# 全テスト
make test-unit && make test-integration && make test-e2e
```

### テストタグ

| タグ | 用途 | ビルド条件 |
|-----|------|-----------|
| `integration` | Repository Integration Test | `-tags=integration` |
| `e2e` | E2E API Test | `-tags=e2e` |
| なし | Unit Test | デフォルト |

### ファイル命名規則

| ファイル名パターン | テスト種別 |
|-------------------|-----------|
| `*_test.go` | Unit Test |
| `*_integration_test.go` | Integration Test（要タグ） |
| `tests/e2e/*_test.go` | E2E Test（要タグ） |

---

## テストケース設計のポイント

### 1. 正常系と異常系のバランス

```
正常系:
├── 基本的なCRUD操作
├── 関連データの操作
└── フィルタリング

異常系:
├── 存在しないリソースへのアクセス
├── 不正な入力値
├── 認可エラー（他人のリソース）
└── DB制約違反
```

### 2. テストの独立性

```go
// 各テストは独立して実行できること
func TestNoteAPI_CRUD(t *testing.T) {
    // 新しいコンテナを起動
    pg := basetestutil.SetupPostgres(t)
    server := testutil.StartTestServer(t, pg.ConnectionString)

    // このテスト専用のデータを作成
    data := basetestutil.CreateDefaultTestData(t, server.Pool())

    // テスト実行
    // ...

    // t.Cleanup で自動クリーンアップ
}
```

### 3. サブテストの活用

```go
func TestNoteAPI_CRUD(t *testing.T) {
    // セットアップ（共通）
    pg := basetestutil.SetupPostgres(t)
    server := testutil.StartTestServer(t, pg.ConnectionString)

    var createdNoteID string

    // サブテストは順番に実行される
    t.Run("POST - Create", func(t *testing.T) {
        // 作成
        createdNoteID = result["id"].(string)
    })

    t.Run("GET - Get", func(t *testing.T) {
        // 前のサブテストで作成したIDを使用
        resp, _ := http.Get(server.URL + "/api/notes/" + createdNoteID)
    })
}
```

### 4. デバッグしやすいアサーション

```go
// 悪い例: 情報が少ない
assert.Equal(t, http.StatusOK, resp.StatusCode)

// 良い例: エラー時にレスポンスボディを表示
if resp.StatusCode != http.StatusOK {
    t.Logf("Response body: %+v", result)
}
require.Equal(t, http.StatusOK, resp.StatusCode)
```

---

## 関連ドキュメント

- [06_testing_strategy.md](./06_testing_strategy.md) - テスト戦略の基礎知識
- [README.md](./README.md) - ドキュメント一覧
