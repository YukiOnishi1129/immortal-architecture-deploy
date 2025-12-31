import { describe, expect, it } from "vitest";
import {
  AccountResponseSchema,
  CreateAccountRequestSchema,
  GetAccountByEmailRequestSchema,
  GetAccountByIdRequestSchema,
  UpdateAccountByIdRequestSchema,
  UpdateAccountRequestSchema,
} from "./account.dto";

// =============================================================================
// テストデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const INVALID_UUID = "not-a-uuid";
const VALID_EMAIL = "test@example.com";
const INVALID_EMAIL = "not-an-email";

const validAccountResponse = {
  id: VALID_UUID,
  email: VALID_EMAIL,
  firstName: "太郎",
  lastName: "山田",
  fullName: "山田 太郎",
  thumbnail: "https://example.com/avatar.jpg",
  lastLoginAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// =============================================================================
// GetAccountByIdRequestSchema
// =============================================================================
describe("GetAccountByIdRequestSchema", () => {
  it("[Success] 有効なUUIDでパースできる", () => {
    const result = GetAccountByIdRequestSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なUUIDでエラーになる", () => {
    const result = GetAccountByIdRequestSchema.safeParse({ id: INVALID_UUID });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが未定義でエラーになる", () => {
    const result = GetAccountByIdRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// GetAccountByEmailRequestSchema
// =============================================================================
describe("GetAccountByEmailRequestSchema", () => {
  it("[Success] 有効なメールアドレスでパースできる", () => {
    const result = GetAccountByEmailRequestSchema.safeParse({
      email: VALID_EMAIL,
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] 不正なメールアドレスでエラーになる", () => {
    const result = GetAccountByEmailRequestSchema.safeParse({
      email: INVALID_EMAIL,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] emailが未定義でエラーになる", () => {
    const result = GetAccountByEmailRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("[Fail] 空文字でエラーになる", () => {
    const result = GetAccountByEmailRequestSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// CreateAccountRequestSchema
// =============================================================================
describe("CreateAccountRequestSchema", () => {
  const validCreateRequest = {
    email: VALID_EMAIL,
    name: "山田 太郎",
    provider: "google",
    providerAccountId: "google-account-123",
  };

  it("[Success] 有効なリクエストでパースできる", () => {
    const result = CreateAccountRequestSchema.safeParse(validCreateRequest);
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailを含むリクエストでパースできる", () => {
    const result = CreateAccountRequestSchema.safeParse({
      ...validCreateRequest,
      thumbnail: "https://example.com/avatar.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailがundefinedでパースできる", () => {
    const result = CreateAccountRequestSchema.safeParse(validCreateRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thumbnail).toBeUndefined();
    }
  });

  it("[Fail] emailが不正でエラーになる", () => {
    const result = CreateAccountRequestSchema.safeParse({
      ...validCreateRequest,
      email: INVALID_EMAIL,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] nameが未定義でエラーになる", () => {
    const { name: _name, ...withoutName } = validCreateRequest;
    const result = CreateAccountRequestSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it("[Fail] providerが未定義でエラーになる", () => {
    const { provider: _provider, ...withoutProvider } = validCreateRequest;
    const result = CreateAccountRequestSchema.safeParse(withoutProvider);
    expect(result.success).toBe(false);
  });

  it("[Fail] providerAccountIdが未定義でエラーになる", () => {
    const {
      providerAccountId: _providerAccountId,
      ...withoutProviderAccountId
    } = validCreateRequest;
    const result = CreateAccountRequestSchema.safeParse(
      withoutProviderAccountId,
    );
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// UpdateAccountRequestSchema
// =============================================================================
describe("UpdateAccountRequestSchema", () => {
  it("[Success] 空オブジェクトでパースできる（全てoptional）", () => {
    const result = UpdateAccountRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("[Success] firstNameのみ指定でパースできる", () => {
    const result = UpdateAccountRequestSchema.safeParse({ firstName: "太郎" });
    expect(result.success).toBe(true);
  });

  it("[Success] lastNameのみ指定でパースできる", () => {
    const result = UpdateAccountRequestSchema.safeParse({ lastName: "山田" });
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailがnullでパースできる", () => {
    const result = UpdateAccountRequestSchema.safeParse({ thumbnail: null });
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailが文字列でパースできる", () => {
    const result = UpdateAccountRequestSchema.safeParse({
      thumbnail: "https://example.com/avatar.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("[Success] 全フィールド指定でパースできる", () => {
    const result = UpdateAccountRequestSchema.safeParse({
      firstName: "太郎",
      lastName: "山田",
      thumbnail: "https://example.com/avatar.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] firstNameが空文字でエラーになる", () => {
    const result = UpdateAccountRequestSchema.safeParse({ firstName: "" });
    expect(result.success).toBe(false);
  });

  it("[Fail] lastNameが空文字でエラーになる", () => {
    const result = UpdateAccountRequestSchema.safeParse({ lastName: "" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// UpdateAccountByIdRequestSchema
// =============================================================================
describe("UpdateAccountByIdRequestSchema", () => {
  it("[Success] idのみ指定でパースできる（他はoptional）", () => {
    const result = UpdateAccountByIdRequestSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("[Success] 全フィールド指定でパースできる", () => {
    const result = UpdateAccountByIdRequestSchema.safeParse({
      id: VALID_UUID,
      firstName: "太郎",
      lastName: "山田",
      thumbnail: "https://example.com/avatar.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = UpdateAccountByIdRequestSchema.safeParse({
      id: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] idが未定義でエラーになる", () => {
    const result = UpdateAccountByIdRequestSchema.safeParse({
      firstName: "太郎",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] firstNameが空文字でエラーになる", () => {
    const result = UpdateAccountByIdRequestSchema.safeParse({
      id: VALID_UUID,
      firstName: "",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// AccountResponseSchema
// =============================================================================
describe("AccountResponseSchema", () => {
  it("[Success] 有効なレスポンスでパースできる", () => {
    const result = AccountResponseSchema.safeParse(validAccountResponse);
    expect(result.success).toBe(true);
  });

  it("[Success] thumbnailがnullでパースできる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      thumbnail: null,
    });
    expect(result.success).toBe(true);
  });

  it("[Success] lastLoginAtがnullでパースできる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      lastLoginAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] idが不正なUUIDでエラーになる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      id: INVALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] emailが不正でエラーになる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      email: INVALID_EMAIL,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] firstNameが欠けているとエラーになる", () => {
    const { firstName: _firstName, ...withoutFirstName } = validAccountResponse;
    const result = AccountResponseSchema.safeParse(withoutFirstName);
    expect(result.success).toBe(false);
  });

  it("[Fail] lastNameが欠けているとエラーになる", () => {
    const { lastName: _lastName, ...withoutLastName } = validAccountResponse;
    const result = AccountResponseSchema.safeParse(withoutLastName);
    expect(result.success).toBe(false);
  });

  it("[Fail] fullNameが欠けているとエラーになる", () => {
    const { fullName: _fullName, ...withoutFullName } = validAccountResponse;
    const result = AccountResponseSchema.safeParse(withoutFullName);
    expect(result.success).toBe(false);
  });

  it("[Fail] createdAtが不正な日時形式でエラーになる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      createdAt: "invalid-date",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] updatedAtが不正な日時形式でエラーになる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      updatedAt: "invalid-date",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] lastLoginAtが不正な日時形式でエラーになる", () => {
    const result = AccountResponseSchema.safeParse({
      ...validAccountResponse,
      lastLoginAt: "invalid-date",
    });
    expect(result.success).toBe(false);
  });
});
