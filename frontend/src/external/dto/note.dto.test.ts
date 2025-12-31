import { describe, expect, it } from "vitest";
import {
  CreateNoteRequestSchema,
  DeleteNoteRequestSchema,
  GetNoteByIdRequestSchema,
  ListMyNoteRequestSchema,
  ListNoteRequestSchema,
  NoteResponseSchema,
  OwnerSchema,
  PublishNoteRequestSchema,
  SectionInputSchema,
  SectionResponseSchema,
  UnpublishNoteRequestSchema,
  UpdateNoteRequestSchema,
} from "./note.dto";

// =============================================================================
// テストデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const INVALID_UUID = "not-a-uuid";

const validOwner = {
  id: VALID_UUID,
  firstName: "太郎",
  lastName: "山田",
  thumbnail: null,
};

const validSection = {
  id: VALID_UUID,
  fieldId: VALID_UUID,
  fieldLabel: "フィールドラベル",
  content: "コンテンツ",
  isRequired: true,
};

const validNoteResponse = {
  id: VALID_UUID,
  title: "テストノート",
  templateId: VALID_UUID,
  templateName: "テンプレート名",
  ownerId: VALID_UUID,
  owner: validOwner,
  status: "Draft" as const,
  sections: [validSection],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// =============================================================================
// GetNoteByIdRequestSchema
// =============================================================================
describe("GetNoteByIdRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = GetNoteByIdRequestSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = GetNoteByIdRequestSchema.safeParse({ id: INVALID_UUID });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが空文字でエラーになる", () => {
    const result = GetNoteByIdRequestSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが未定義でエラーになる", () => {
    const result = GetNoteByIdRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ListNoteRequestSchema
// =============================================================================
describe("ListNoteRequestSchema", () => {
  it("[Success] 空オブジェクトでパースできる（全てoptional）", () => {
    const result = ListNoteRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("[Success] 全フィールド指定でパースできる", () => {
    const result = ListNoteRequestSchema.safeParse({
      status: "Publish",
      templateId: VALID_UUID,
      q: "検索クエリ",
      page: 1,
      ownerId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] statusが不正な値でエラーになる", () => {
    const result = ListNoteRequestSchema.safeParse({ status: "Invalid" });
    expect(result.success).toBe(false);
  });

  it("[Fail] pageが0以下でエラーになる", () => {
    const result = ListNoteRequestSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("[Fail] pageが負数でエラーになる", () => {
    const result = ListNoteRequestSchema.safeParse({ page: -1 });
    expect(result.success).toBe(false);
  });

  it("[Fail] pageが小数でエラーになる", () => {
    const result = ListNoteRequestSchema.safeParse({ page: 1.5 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ListMyNoteRequestSchema
// =============================================================================
describe("ListMyNoteRequestSchema", () => {
  it("[Success] 空オブジェクトでパースできる", () => {
    const result = ListMyNoteRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("[Success] statusがDraftでパースできる", () => {
    const result = ListMyNoteRequestSchema.safeParse({ status: "Draft" });
    expect(result.success).toBe(true);
  });

  it("[Success] statusがPublishでパースできる", () => {
    const result = ListMyNoteRequestSchema.safeParse({ status: "Publish" });
    expect(result.success).toBe(true);
  });

  it("[Fail] statusが不正な値でエラーになる", () => {
    const result = ListMyNoteRequestSchema.safeParse({ status: "Archived" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// OwnerSchema
// =============================================================================
describe("OwnerSchema", () => {
  it("[Success] 有効なオーナー情報でパースできる", () => {
    const result = OwnerSchema.safeParse(validOwner);
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailがnullでパースできる", () => {
    const result = OwnerSchema.safeParse({ ...validOwner, thumbnail: null });
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailが文字列でパースできる", () => {
    const result = OwnerSchema.safeParse({
      ...validOwner,
      thumbnail: "https://example.com/image.png",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = OwnerSchema.safeParse({ ...validOwner, id: INVALID_UUID });
    expect(result.success).toBe(false);
  });

  it("[Fail] firstNameが欠けているとエラーになる", () => {
    const { firstName: _firstName, ...withoutFirstName } = validOwner;
    const result = OwnerSchema.safeParse(withoutFirstName);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SectionResponseSchema
// =============================================================================
describe("SectionResponseSchema", () => {
  it("[Success] 有効なセクションでパースできる", () => {
    const result = SectionResponseSchema.safeParse(validSection);
    expect(result.success).toBe(true);
  });

  it("[Fail] isRequiredがbooleanでないとエラーになる", () => {
    const result = SectionResponseSchema.safeParse({
      ...validSection,
      isRequired: "true",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] fieldIdが不正なUUIDでエラーになる", () => {
    const result = SectionResponseSchema.safeParse({
      ...validSection,
      fieldId: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SectionInputSchema
// =============================================================================
describe("SectionInputSchema", () => {
  it("[Success] 有効な入力でパースできる", () => {
    const result = SectionInputSchema.safeParse({
      fieldId: VALID_UUID,
      content: "コンテンツ",
    });
    expect(result.success).toBe(true);
  });

  it("[Success] contentが空文字でもパースできる", () => {
    const result = SectionInputSchema.safeParse({
      fieldId: VALID_UUID,
      content: "",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] fieldIdが不正でエラーになる", () => {
    const result = SectionInputSchema.safeParse({
      fieldId: INVALID_UUID,
      content: "コンテンツ",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// NoteResponseSchema
// =============================================================================
describe("NoteResponseSchema", () => {
  it("[Success] 有効なレスポンスでパースできる", () => {
    const result = NoteResponseSchema.safeParse(validNoteResponse);
    expect(result.success).toBe(true);
  });

  it("[Success] sectionsが空配列でもパースできる", () => {
    const result = NoteResponseSchema.safeParse({
      ...validNoteResponse,
      sections: [],
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] statusが不正な値でエラーになる", () => {
    const result = NoteResponseSchema.safeParse({
      ...validNoteResponse,
      status: "Invalid",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = NoteResponseSchema.safeParse({
      ...validNoteResponse,
      id: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] titleが欠けているとエラーになる", () => {
    const { title: _title, ...withoutTitle } = validNoteResponse;
    const result = NoteResponseSchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });

  it("[Fail] ownerが欠けているとエラーになる", () => {
    const { owner: _owner, ...withoutOwner } = validNoteResponse;
    const result = NoteResponseSchema.safeParse(withoutOwner);
    expect(result.success).toBe(false);
  });

  it("[Fail] createdAtが不正な日時形式でエラーになる", () => {
    const result = NoteResponseSchema.safeParse({
      ...validNoteResponse,
      createdAt: "invalid-date",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// CreateNoteRequestSchema
// =============================================================================
describe("CreateNoteRequestSchema", () => {
  const validCreateRequest = {
    title: "新しいノート",
    templateId: VALID_UUID,
    sections: [{ fieldId: VALID_UUID, content: "内容" }],
  };

  it("[Success] 有効なリクエストでパースできる", () => {
    const result = CreateNoteRequestSchema.safeParse(validCreateRequest);
    expect(result.success).toBe(true);
  });

  it("[Success] sectionsが空配列でもパースできる", () => {
    const result = CreateNoteRequestSchema.safeParse({
      ...validCreateRequest,
      sections: [],
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] titleが空文字でエラーになる", () => {
    const result = CreateNoteRequestSchema.safeParse({
      ...validCreateRequest,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] titleが100文字を超えるとエラーになる", () => {
    const result = CreateNoteRequestSchema.safeParse({
      ...validCreateRequest,
      title: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("[Success] titleが100文字ちょうどでパースできる", () => {
    const result = CreateNoteRequestSchema.safeParse({
      ...validCreateRequest,
      title: "a".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it("[Success] titleが1文字でパースできる", () => {
    const result = CreateNoteRequestSchema.safeParse({
      ...validCreateRequest,
      title: "a",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] templateIdが不正なUUIDでエラーになる", () => {
    const result = CreateNoteRequestSchema.safeParse({
      ...validCreateRequest,
      templateId: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// UpdateNoteRequestSchema
// =============================================================================
describe("UpdateNoteRequestSchema", () => {
  const validUpdateRequest = {
    title: "更新されたノート",
    sections: [{ id: VALID_UUID, content: "更新内容" }],
  };

  it("[Success] 有効なリクエストでパースできる", () => {
    const result = UpdateNoteRequestSchema.safeParse(validUpdateRequest);
    expect(result.success).toBe(true);
  });

  it("[Fail] titleが空文字でエラーになる", () => {
    const result = UpdateNoteRequestSchema.safeParse({
      ...validUpdateRequest,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] titleが100文字を超えるとエラーになる", () => {
    const result = UpdateNoteRequestSchema.safeParse({
      ...validUpdateRequest,
      title: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] sectionsのidが不正なUUIDでエラーになる", () => {
    const result = UpdateNoteRequestSchema.safeParse({
      ...validUpdateRequest,
      sections: [{ id: INVALID_UUID, content: "内容" }],
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// DeleteNoteRequestSchema
// =============================================================================
describe("DeleteNoteRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = DeleteNoteRequestSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = DeleteNoteRequestSchema.safeParse({ id: INVALID_UUID });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// PublishNoteRequestSchema
// =============================================================================
describe("PublishNoteRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = PublishNoteRequestSchema.safeParse({ noteId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = PublishNoteRequestSchema.safeParse({ noteId: INVALID_UUID });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// UnpublishNoteRequestSchema
// =============================================================================
describe("UnpublishNoteRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = UnpublishNoteRequestSchema.safeParse({ noteId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = UnpublishNoteRequestSchema.safeParse({
      noteId: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });
});
