import { describe, expect, it } from "vitest";
import {
  CreateTemplateRequestSchema,
  DeleteTemplateRequestSchema,
  FieldInputSchema,
  FieldResponseSchema,
  GetTemplateByIdRequestSchema,
  ListTemplateRequestSchema,
  OwnerSchema,
  TemplateResponseSchema,
  UpdateTemplateRequestSchema,
} from "./template.dto";

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

const validField = {
  id: VALID_UUID,
  label: "フィールドラベル",
  order: 1,
  isRequired: true,
};

const validTemplateResponse = {
  id: VALID_UUID,
  name: "テンプレート名",
  ownerId: VALID_UUID,
  owner: validOwner,
  fields: [validField],
  updatedAt: "2024-01-01T00:00:00.000Z",
  isUsed: false,
};

// =============================================================================
// GetTemplateByIdRequestSchema
// =============================================================================
describe("GetTemplateByIdRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = GetTemplateByIdRequestSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = GetTemplateByIdRequestSchema.safeParse({ id: INVALID_UUID });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが未定義でエラーになる", () => {
    const result = GetTemplateByIdRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ListTemplateRequestSchema
// =============================================================================
describe("ListTemplateRequestSchema", () => {
  it("[Success] 空オブジェクトでパースできる（全てoptional）", () => {
    const result = ListTemplateRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("[Success] 全フィールド指定でパースできる", () => {
    const result = ListTemplateRequestSchema.safeParse({
      ownerId: VALID_UUID,
      q: "検索クエリ",
      onlyMyTemplates: true,
    });
    expect(result.success).toBe(true);
  });

  it("[Success] onlyMyTemplatesがfalseでパースできる", () => {
    const result = ListTemplateRequestSchema.safeParse({
      onlyMyTemplates: false,
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] ownerIdが不正なUUIDでエラーになる", () => {
    const result = ListTemplateRequestSchema.safeParse({
      ownerId: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] onlyMyTemplatesがbooleanでないとエラーになる", () => {
    const result = ListTemplateRequestSchema.safeParse({
      onlyMyTemplates: "true",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// FieldResponseSchema
// =============================================================================
describe("FieldResponseSchema", () => {
  it("[Success] 有効なフィールドでパースできる", () => {
    const result = FieldResponseSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });

  it("[Fail] orderが0以下でエラーになる", () => {
    const result = FieldResponseSchema.safeParse({ ...validField, order: 0 });
    expect(result.success).toBe(false);
  });

  it("[Fail] orderが負数でエラーになる", () => {
    const result = FieldResponseSchema.safeParse({ ...validField, order: -1 });
    expect(result.success).toBe(false);
  });

  it("[Fail] orderが小数でエラーになる", () => {
    const result = FieldResponseSchema.safeParse({ ...validField, order: 1.5 });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = FieldResponseSchema.safeParse({
      ...validField,
      id: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] isRequiredがbooleanでないとエラーになる", () => {
    const result = FieldResponseSchema.safeParse({
      ...validField,
      isRequired: "true",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// FieldInputSchema
// =============================================================================
describe("FieldInputSchema", () => {
  const validFieldInput = {
    label: "ラベル",
    order: 1,
    isRequired: true,
  };

  it("[Success] 有効な入力でパースできる", () => {
    const result = FieldInputSchema.safeParse(validFieldInput);
    expect(result.success).toBe(true);
  });

  it("[Fail] labelが空文字でエラーになる", () => {
    const result = FieldInputSchema.safeParse({
      ...validFieldInput,
      label: "",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] labelが100文字を超えるとエラーになる", () => {
    const result = FieldInputSchema.safeParse({
      ...validFieldInput,
      label: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("[Success] labelが100文字ちょうどでパースできる", () => {
    const result = FieldInputSchema.safeParse({
      ...validFieldInput,
      label: "a".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] orderが0でエラーになる", () => {
    const result = FieldInputSchema.safeParse({ ...validFieldInput, order: 0 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// OwnerSchema
// =============================================================================
describe("OwnerSchema (Template)", () => {
  it("[Success] 有効なオーナー情報でパースできる", () => {
    const result = OwnerSchema.safeParse(validOwner);
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailがnullでパースできる", () => {
    const result = OwnerSchema.safeParse({ ...validOwner, thumbnail: null });
    expect(result.success).toBe(true);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = OwnerSchema.safeParse({ ...validOwner, id: INVALID_UUID });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// TemplateResponseSchema
// =============================================================================
describe("TemplateResponseSchema", () => {
  it("[Success] 有効なレスポンスでパースできる", () => {
    const result = TemplateResponseSchema.safeParse(validTemplateResponse);
    expect(result.success).toBe(true);
  });

  it("[Success] fieldsが空配列でもパースできる", () => {
    const result = TemplateResponseSchema.safeParse({
      ...validTemplateResponse,
      fields: [],
    });
    expect(result.success).toBe(true);
  });

  it("[Success] isUsedがundefinedでもパースできる", () => {
    const { isUsed: _isUsed, ...withoutIsUsed } = validTemplateResponse;
    const result = TemplateResponseSchema.safeParse(withoutIsUsed);
    expect(result.success).toBe(true);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = TemplateResponseSchema.safeParse({
      ...validTemplateResponse,
      id: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] nameが欠けているとエラーになる", () => {
    const { name: _name, ...withoutName } = validTemplateResponse;
    const result = TemplateResponseSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it("[Fail] ownerが欠けているとエラーになる", () => {
    const { owner: _owner, ...withoutOwner } = validTemplateResponse;
    const result = TemplateResponseSchema.safeParse(withoutOwner);
    expect(result.success).toBe(false);
  });

  it("[Fail] updatedAtが不正な日時形式でエラーになる", () => {
    const result = TemplateResponseSchema.safeParse({
      ...validTemplateResponse,
      updatedAt: "invalid-date",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// CreateTemplateRequestSchema
// =============================================================================
describe("CreateTemplateRequestSchema", () => {
  const validCreateRequest = {
    name: "新しいテンプレート",
    fields: [{ label: "フィールド1", order: 1, isRequired: true }],
  };

  it("[Success] 有効なリクエストでパースできる", () => {
    const result = CreateTemplateRequestSchema.safeParse(validCreateRequest);
    expect(result.success).toBe(true);
  });

  it("[Fail] nameが空文字でエラーになる", () => {
    const result = CreateTemplateRequestSchema.safeParse({
      ...validCreateRequest,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] nameが100文字を超えるとエラーになる", () => {
    const result = CreateTemplateRequestSchema.safeParse({
      ...validCreateRequest,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("[Success] nameが100文字ちょうどでパースできる", () => {
    const result = CreateTemplateRequestSchema.safeParse({
      ...validCreateRequest,
      name: "a".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] fieldsが空配列でエラーになる", () => {
    const result = CreateTemplateRequestSchema.safeParse({
      ...validCreateRequest,
      fields: [],
    });
    expect(result.success).toBe(false);
  });

  it("[Success] fieldsが1つでパースできる", () => {
    const result = CreateTemplateRequestSchema.safeParse(validCreateRequest);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// UpdateTemplateRequestSchema
// =============================================================================
describe("UpdateTemplateRequestSchema", () => {
  const validUpdateRequest = {
    name: "更新されたテンプレート",
    fields: [
      { id: VALID_UUID, label: "更新フィールド", order: 1, isRequired: false },
    ],
  };

  it("[Success] 有効なリクエストでパースできる", () => {
    const result = UpdateTemplateRequestSchema.safeParse(validUpdateRequest);
    expect(result.success).toBe(true);
  });

  it("[Success] fieldsのidがundefinedでもパースできる（新規フィールド）", () => {
    const result = UpdateTemplateRequestSchema.safeParse({
      ...validUpdateRequest,
      fields: [{ label: "新規フィールド", order: 1, isRequired: true }],
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] nameが空文字でエラーになる", () => {
    const result = UpdateTemplateRequestSchema.safeParse({
      ...validUpdateRequest,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] fieldsが空配列でエラーになる", () => {
    const result = UpdateTemplateRequestSchema.safeParse({
      ...validUpdateRequest,
      fields: [],
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] fieldsのlabelが空文字でエラーになる", () => {
    const result = UpdateTemplateRequestSchema.safeParse({
      ...validUpdateRequest,
      fields: [{ id: VALID_UUID, label: "", order: 1, isRequired: true }],
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// DeleteTemplateRequestSchema
// =============================================================================
describe("DeleteTemplateRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = DeleteTemplateRequestSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = DeleteTemplateRequestSchema.safeParse({ id: INVALID_UUID });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが未定義でエラーになる", () => {
    const result = DeleteTemplateRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
