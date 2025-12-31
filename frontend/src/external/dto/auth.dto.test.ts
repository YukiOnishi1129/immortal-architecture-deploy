import { describe, expect, it } from "vitest";
import {
  RefreshGoogleTokensRequestSchema,
  RefreshGoogleTokensResponseSchema,
} from "./auth.dto";

// =============================================================================
// RefreshGoogleTokensRequestSchema
// =============================================================================
describe("RefreshGoogleTokensRequestSchema", () => {
  it("[Success] 有効なリクエストでパースできる", () => {
    const result = RefreshGoogleTokensRequestSchema.safeParse({
      refreshToken: "valid-refresh-token",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] refreshTokenが空文字でエラーになる", () => {
    const result = RefreshGoogleTokensRequestSchema.safeParse({
      refreshToken: "",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] refreshTokenが未定義でエラーになる", () => {
    const result = RefreshGoogleTokensRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// RefreshGoogleTokensResponseSchema
// =============================================================================
describe("RefreshGoogleTokensResponseSchema", () => {
  it("[Success] 有効なレスポンスでパースできる", () => {
    const result = RefreshGoogleTokensResponseSchema.safeParse({
      accessToken: "access-token",
      idToken: "id-token",
      accessTokenExpires: 1234567890,
    });
    expect(result.success).toBe(true);
  });

  it("[Success] 全てnullでパースできる", () => {
    const result = RefreshGoogleTokensResponseSchema.safeParse({
      accessToken: null,
      idToken: null,
      accessTokenExpires: null,
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] accessTokenExpiresが小数でエラーになる", () => {
    const result = RefreshGoogleTokensResponseSchema.safeParse({
      accessToken: "token",
      idToken: "id",
      accessTokenExpires: 123.456,
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] accessTokenが未定義でエラーになる", () => {
    const result = RefreshGoogleTokensResponseSchema.safeParse({
      idToken: "id-token",
      accessTokenExpires: 1234567890,
    });
    expect(result.success).toBe(false);
  });
});
