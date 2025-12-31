# 🧪 BFF（Backend for Frontend）テスト戦略ガイド

> 💡 **このドキュメントのゴール**
> external層（BFF）の責務を理解し、バックエンドとして適切なテスト戦略を身につける

---

## 📚 目次

1. [BFFとは何か](#bffとは何か)
2. [external層のアーキテクチャ](#external層のアーキテクチャ)
3. [テスト戦略](#テスト戦略)
4. [各レイヤーのテスト実装例](#各レイヤーのテスト実装例)
5. [テストファイルの配置](#テストファイルの配置)
6. [よくある質問](#よくある質問)

---

## BFFとは何か

### 🎯 BFF（Backend for Frontend）の役割

```
┌─────────────────────────────────────────────────────────────────┐
│                      アーキテクチャ全体像                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ブラウザ                                                      │
│     │                                                           │
│     ▼                                                           │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Next.js App (フロントエンド)                            │  │
│   │                                                         │  │
│   │  ┌─────────────────────────────────────────────────┐    │  │
│   │  │  features/                                       │    │  │
│   │  │  (React Components, Hooks, Pages)               │    │  │
│   │  └─────────────────────────────────────────────────┘    │  │
│   │                      │                                  │  │
│   │                      ▼                                  │  │
│   │  ┌─────────────────────────────────────────────────┐    │  │
│   │  │  external/ ← ★ BFF層（このドキュメントの対象）   │    │  │
│   │  │  (Handler, Service, DTO, Client)                │    │  │
│   │  └─────────────────────────────────────────────────┘    │  │
│   │                      │                                  │  │
│   └──────────────────────┼──────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Go Backend API                                          │  │
│   │  (Clean Architecture)                                    │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### なぜBFF層が必要なのか？

```
BFF層がない場合:
┌─────────────────────────────────────────────────────────────────┐
│  React Component                                                │
│    │                                                            │
│    ├─ fetch('http://backend/api/notes') ← URLハードコード       │
│    ├─ レスポンスの型を信頼 ← 危険！                             │
│    ├─ 認証トークンの管理 ← 各所にバラバラ                       │
│    └─ エラーハンドリング ← 統一されていない                     │
└─────────────────────────────────────────────────────────────────┘

BFF層がある場合:
┌─────────────────────────────────────────────────────────────────┐
│  React Component                                                │
│    │                                                            │
│    └─ Server Action / Hook                                     │
│          │                                                      │
│          └─ BFF層（external/）                                  │
│                ├─ Handler: 認証チェック、入力バリデーション     │
│                ├─ Service: API呼び出し、エラーハンドリング      │
│                ├─ DTO: レスポンスの型安全性（Zod）              │
│                └─ Client: OpenAPI生成のAPIクライアント          │
└─────────────────────────────────────────────────────────────────┘
```

---

## external層のアーキテクチャ

### 📁 ディレクトリ構成

```
src/external/
├── client/               # APIクライアント（OpenAPI生成）
│   └── api/
│       ├── config.ts     # クライアント設定
│       └── generated/    # openapi-generator で生成
│           ├── apis/     # API呼び出しクラス
│           └── models/   # 型定義
│
├── dto/                  # Data Transfer Object（Zodスキーマ）
│   ├── note.dto.ts       # ノート用DTO
│   ├── template.dto.ts   # テンプレート用DTO
│   └── account.dto.ts    # アカウント用DTO
│
├── service/              # ビジネスロジック（API呼び出し + 変換）
│   ├── note/
│   │   └── note.service.ts
│   ├── template/
│   │   └── template.service.ts
│   └── account/
│       └── account.service.ts
│
└── handler/              # Server Actions / Server Functions
    ├── note/
    │   ├── note.query.server.ts    # 読み取り（Server Function）
    │   ├── note.query.action.ts    # 読み取り（Server Action）
    │   ├── note.command.server.ts  # 書き込み（Server Function）
    │   └── note.command.action.ts  # 書き込み（Server Action）
    └── ...
```

### 🔄 データフロー

```
Handler（認証 + バリデーション）
    │
    ▼
Service（API呼び出し + 変換）
    │
    ▼
DTO（型変換 + バリデーション）
    │
    ▼
Client（HTTP通信）
    │
    ▼
Go Backend API
```

### 各レイヤーの責務

| レイヤー | 責務 | テスト対象 |
|---------|------|-----------|
| **Handler** | 認証チェック、入力バリデーション、Serviceの呼び出し | ✅ Unit Test |
| **Service** | API呼び出し、レスポンス変換、エラーハンドリング | ✅ Unit Test |
| **DTO** | Zodスキーマ定義、型変換、バリデーション | ✅ Unit Test |
| **Client** | HTTP通信（OpenAPI生成） | ❌ 自動生成なのでテスト不要 |

---

## テスト戦略

### 🏗️ レイヤー別テスト方針

```
┌─────────────────────────────────────────────────────────────────┐
│                    BFF テスト戦略                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Unit Test（Vitest）                                     │   │
│  │                                                         │   │
│  │  DTO / Zod        ✅ 必須   APIとの契約確認             │   │
│  │  Service          ✅ 必須   データ変換、エラーハンドリング│   │
│  │  Handler          ✅ 推奨   認証、バリデーション          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────                             │
│    Client はOpenAPI生成なのでテスト不要                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 📊 まとめ表

| 対象 | Unit Test | テスト内容 |
|------|-----------|-----------|
| **DTO / Zod** | ✅ 必須 | バリデーション、型変換 |
| **Service** | ✅ 必須 | API呼び出し、データ変換、エラーハンドリング |
| **Handler** | ✅ 推奨 | 認証チェック、入力バリデーション |
| **Client** | ❌ 不要 | OpenAPI自動生成 |

### 🎯 この戦略で達成できること

| 目的 | どのテストでカバー？ |
|------|---------------------|
| **APIとの契約確認** | DTO / Zod テスト |
| **データ変換の正しさ** | Service テスト |
| **エラーハンドリング** | Service テスト |
| **認証・認可** | Handler テスト |
| **入力バリデーション** | Handler テスト |

---

## 各レイヤーのテスト実装例

### 1️⃣ DTO / Zodスキーマのテスト

**目的**: バリデーションが正しく動作するか検証

**特徴**:
- APIとの契約を保証
- 境界値テスト
- エラーメッセージの確認

**テスト対象**: `note.dto.ts`

```typescript
// external/dto/note.dto.ts
import { z } from "zod";

export const NoteResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  templateId: z.uuid(),
  templateName: z.string(),
  ownerId: z.uuid(),
  owner: z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    thumbnail: z.string().nullable(),
  }),
  status: z.enum(["Draft", "Publish"]),
  sections: z.array(z.object({
    id: z.uuid(),
    fieldId: z.uuid(),
    fieldLabel: z.string(),
    content: z.string(),
    isRequired: z.boolean(),
  })),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateNoteRequestSchema = z.object({
  title: z.string().min(1).max(100),
  templateId: z.uuid(),
  sections: z.array(z.object({
    fieldId: z.uuid(),
    content: z.string(),
  })),
});
```

**テストコード**:

```typescript
// external/dto/note.dto.test.ts
import { describe, it, expect } from 'vitest';
import {
  NoteResponseSchema,
  CreateNoteRequestSchema
} from './note.dto';

describe('NoteResponseSchema', () => {
  const validResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'テストノート',
    templateId: '123e4567-e89b-12d3-a456-426614174001',
    templateName: 'テンプレート',
    ownerId: '123e4567-e89b-12d3-a456-426614174002',
    owner: {
      id: '123e4567-e89b-12d3-a456-426614174002',
      firstName: '太郎',
      lastName: '山田',
      thumbnail: null,
    },
    status: 'Draft',
    sections: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('有効なレスポンスをパースできる', () => {
    const result = NoteResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('不正なステータスでエラーになる', () => {
    const invalid = { ...validResponse, status: 'InvalidStatus' };
    const result = NoteResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('UUIDが不正な形式でエラーになる', () => {
    const invalid = { ...validResponse, id: 'not-a-uuid' };
    const result = NoteResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('必須フィールドが欠けているとエラーになる', () => {
    const { title, ...withoutTitle } = validResponse;
    const result = NoteResponseSchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });
});

describe('CreateNoteRequestSchema', () => {
  it('タイトルが空文字でエラーになる', () => {
    const request = {
      title: '',
      templateId: '123e4567-e89b-12d3-a456-426614174000',
      sections: [],
    };
    const result = CreateNoteRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('タイトルが100文字を超えるとエラーになる', () => {
    const request = {
      title: 'a'.repeat(101),
      templateId: '123e4567-e89b-12d3-a456-426614174000',
      sections: [],
    };
    const result = CreateNoteRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('タイトルが100文字ちょうどは成功する', () => {
    const request = {
      title: 'a'.repeat(100),
      templateId: '123e4567-e89b-12d3-a456-426614174000',
      sections: [],
    };
    const result = CreateNoteRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });
});
```

**このテストで守れるもの**:
- バックエンドAPIの仕様変更 → テストで検知
- Zodライブラリのバージョンアップ → テストで検知

---

### 2️⃣ Serviceレイヤーのテスト

**目的**: API呼び出しとデータ変換が正しいか検証

**特徴**:
- APIクライアントをモック
- エラーハンドリングの検証
- データ変換ロジックの確認

**テスト対象**: `note.service.ts`

```typescript
// external/service/note/note.service.ts
export class NoteService {
  constructor(private readonly api: NotesApi) {}

  async getNoteById(id: string): Promise<NoteResponse | null> {
    try {
      const note = await this.api.notesGetNoteById({ noteId: id });
      return toNoteResponse(note);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async getNotes(filters?: NoteFilters): Promise<NoteResponse[]> {
    const list = await this.api.notesListNotes({
      q: filters?.q,
      status: toQueryStatus(filters?.status),
      templateId: filters?.templateId,
    });
    return list.map((note) => toNoteResponse(note));
  }
}
```

**テストコード**:

```typescript
// external/service/note/note.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteService } from './note.service';

describe('NoteService', () => {
  const mockApi = {
    notesGetNoteById: vi.fn(),
    notesListNotes: vi.fn(),
    notesCreateNote: vi.fn(),
    notesUpdateNote: vi.fn(),
    notesDeleteNote: vi.fn(),
    notesPublishNote: vi.fn(),
    notesUnpublishNote: vi.fn(),
  };

  const service = new NoteService(mockApi as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNoteById', () => {
    const mockNoteResponse = {
      id: 'note-123',
      title: 'テストノート',
      templateId: 'tpl-123',
      templateName: 'テンプレート',
      ownerId: 'owner-123',
      owner: {
        id: 'owner-123',
        firstName: '太郎',
        lastName: '山田',
        thumbnail: null,
      },
      status: 'Draft',
      sections: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('ノートを取得して正しい形式に変換する', async () => {
      // Arrange
      mockApi.notesGetNoteById.mockResolvedValue(mockNoteResponse);

      // Act
      const result = await service.getNoteById('note-123');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.title).toBe('テストノート');
      // Date → ISO文字列に変換されていることを確認
      expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('ノートが見つからない場合はnullを返す', async () => {
      // Arrange
      const error = new Error('Not Found');
      (error as any).response = { status: 404 };
      mockApi.notesGetNoteById.mockRejectedValue(error);

      // Act
      const result = await service.getNoteById('not-exist');

      // Assert
      expect(result).toBeNull();
    });

    it('404以外のエラーは再スローする', async () => {
      // Arrange
      const error = new Error('Internal Server Error');
      (error as any).response = { status: 500 };
      mockApi.notesGetNoteById.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getNoteById('note-123'))
        .rejects.toThrow('Internal Server Error');
    });
  });

  describe('getNotes', () => {
    it('フィルタを正しくAPIに渡す', async () => {
      // Arrange
      mockApi.notesListNotes.mockResolvedValue([]);
      const filters = { status: 'Publish' as const, q: '検索' };

      // Act
      await service.getNotes(filters);

      // Assert
      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: '検索',
        status: 'Publish',
        templateId: undefined,
      });
    });

    it('フィルタなしでも動作する', async () => {
      // Arrange
      mockApi.notesListNotes.mockResolvedValue([]);

      // Act
      await service.getNotes();

      // Assert
      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: undefined,
        status: undefined,
        templateId: undefined,
      });
    });
  });
});
```

**このテストで守れるもの**:
- APIレスポンスの変換ロジック誤り → テストで検知
- エラーハンドリングの漏れ → テストで検知
- フィルタパラメータの受け渡しミス → テストで検知

---

### 3️⃣ Handlerのテスト

**目的**: 認証チェックと入力バリデーションが正しく動作するか検証

**特徴**:
- 認証をモック
- Serviceをモック
- 入力バリデーションの検証

**テスト対象**: `note.query.server.ts`

```typescript
// external/handler/note/note.query.server.ts
import "server-only";
import { requireAuthServer } from "@/features/auth/servers/redirect.server";
import { GetNoteByIdRequestSchema, NoteResponseSchema } from "../../dto/note.dto";
import { noteService } from "../../service/note/note.service";

export async function getNoteByIdQuery(request: GetNoteByIdRequest) {
  await requireAuthServer();

  const validated = GetNoteByIdRequestSchema.parse(request);
  const note = await noteService.getNoteById(validated.id);

  if (!note) {
    return null;
  }

  return NoteResponseSchema.parse(note);
}
```

**テストコード**:

```typescript
// external/handler/note/note.query.server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック設定
vi.mock('@/features/auth/servers/redirect.server', () => ({
  requireAuthServer: vi.fn(),
}));

vi.mock('../../service/note/note.service', () => ({
  noteService: {
    getNoteById: vi.fn(),
    getNotes: vi.fn(),
  },
}));

import { getNoteByIdQuery, listNoteQuery } from './note.query.server';
import { requireAuthServer } from '@/features/auth/servers/redirect.server';
import { noteService } from '../../service/note/note.service';

describe('getNoteByIdQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('認証チェックを実行する', async () => {
    // Arrange
    vi.mocked(noteService.getNoteById).mockResolvedValue(null);

    // Act
    await getNoteByIdQuery({ id: '123e4567-e89b-12d3-a456-426614174000' });

    // Assert
    expect(requireAuthServer).toHaveBeenCalled();
  });

  it('不正なUUIDでエラーになる', async () => {
    // Act & Assert
    await expect(getNoteByIdQuery({ id: 'invalid-uuid' }))
      .rejects.toThrow();
  });

  it('ノートが見つからない場合はnullを返す', async () => {
    // Arrange
    vi.mocked(noteService.getNoteById).mockResolvedValue(null);

    // Act
    const result = await getNoteByIdQuery({
      id: '123e4567-e89b-12d3-a456-426614174000'
    });

    // Assert
    expect(result).toBeNull();
  });

  it('ノートを正しく返す', async () => {
    // Arrange
    const mockNote = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'テストノート',
      templateId: '123e4567-e89b-12d3-a456-426614174001',
      templateName: 'テンプレート',
      ownerId: '123e4567-e89b-12d3-a456-426614174002',
      owner: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        firstName: '太郎',
        lastName: '山田',
        thumbnail: null,
      },
      status: 'Draft' as const,
      sections: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(noteService.getNoteById).mockResolvedValue(mockNote);

    // Act
    const result = await getNoteByIdQuery({
      id: '123e4567-e89b-12d3-a456-426614174000'
    });

    // Assert
    expect(result).toEqual(mockNote);
  });
});
```

**このテストで守れるもの**:
- 認証チェックの漏れ → テストで検知
- 入力バリデーションの漏れ → テストで検知
- レスポンスの型安全性 → テストで検知

---

## テストファイルの配置

### コロケーション（同じディレクトリに配置）

```
src/external/
├── dto/
│   ├── note.dto.ts
│   ├── note.dto.test.ts           # ← コロケーション
│   ├── template.dto.ts
│   ├── template.dto.test.ts       # ← コロケーション
│   ├── account.dto.ts
│   └── account.dto.test.ts        # ← コロケーション
│
├── service/
│   ├── note/
│   │   ├── note.service.ts
│   │   └── note.service.test.ts   # ← コロケーション
│   ├── template/
│   │   ├── template.service.ts
│   │   └── template.service.test.ts
│   └── account/
│       ├── account.service.ts
│       └── account.service.test.ts
│
└── handler/
    ├── note/
    │   ├── note.query.server.ts
    │   ├── note.query.server.test.ts  # ← コロケーション
    │   ├── note.command.server.ts
    │   └── note.command.server.test.ts
    └── ...
```

---

## よくある質問

### Q1: なぜClientのテストを書かないのか？

**A: OpenAPIから自動生成されるからです。**

```
OpenAPI Generator の信頼性:
├─ OpenAPI Spec → TypeScript コード自動生成
├─ 型安全性は生成時に保証される
├─ テストは openapi-generator 側の責務
└─ 手動でテストを書く価値がない
```

---

### Q2: ServiceとHandlerの違いは？

**A: 責務が異なります。**

```
Handler（Controller相当）:
├─ 認証・認可チェック
├─ 入力バリデーション（Zodスキーマ）
├─ Serviceの呼び出し
└─ レスポンスの整形

Service（UseCase相当）:
├─ APIクライアントの呼び出し
├─ レスポンスの変換
├─ エラーハンドリング
└─ ビジネスロジック
```

---

### Q3: query.server と query.action の違いは？

**A: 呼び出し元が異なります。**

```
*.query.server.ts / *.command.server.ts:
├─ Server Component から呼び出される
├─ "server-only" でクライアント利用を禁止
└─ プリフェッチなどで使用

*.query.action.ts / *.command.action.ts:
├─ Client Component から呼び出される
├─ "use server" でServer Actionとして定義
└─ ユーザー操作のハンドリングで使用
```

---

### Q4: テストが遅いときはどうする？

**A: 以下を確認してください。**

```
1. モックを確認
   → APIクライアントがモックされているか

2. 非同期処理の待機
   → 不要なsetTimeoutがないか

3. テストの独立性
   → beforeEach で状態をリセットしているか
```

---

## 🚀 実行コマンド

```bash
# Unit テスト（BFF層）
pnpm test src/external        # external配下のテストのみ
pnpm test:watch               # ウォッチモード
pnpm test:coverage            # カバレッジ付き
```

---

## まとめ

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ✅ テストする                                              │
│  ├── DTO / Zod → APIとの契約確認、型安全性                 │
│  ├── Service → データ変換、エラーハンドリング              │
│  └── Handler → 認証チェック、入力バリデーション            │
│                                                             │
│  ❌ テストしない                                            │
│  └── Client → OpenAPI自動生成                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 参考リソース

- [Vitest 公式ドキュメント](https://vitest.dev/)
- [Zod 公式ドキュメント](https://zod.dev/)
- [OpenAPI Generator](https://openapi-generator.tech/)
