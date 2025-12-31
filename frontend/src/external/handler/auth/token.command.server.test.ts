import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// サービスモック - vi.hoisted を使用してホイスティング問題を解決
const { mockRefreshTokens } = vi.hoisted(() => ({
  mockRefreshTokens: vi.fn(),
}));

vi.mock("@/external/service/auth/token-verification.service", () => ({
  TokenVerificationService: class {
    refreshTokens = mockRefreshTokens;
  },
}));

import { refreshGoogleTokenCommand } from "./token.command.server";

// =============================================================================
// refreshGoogleTokenCommand
// =============================================================================
describe("refreshGoogleTokenCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] トークンをリフレッシュできる", async () => {
    mockRefreshTokens.mockResolvedValue({
      accessToken: "new-access-token",
      idToken: "new-id-token",
      expiryDate: 1234567890,
    });

    const result = await refreshGoogleTokenCommand({
      refreshToken: "valid-refresh-token",
    });

    expect(result).toEqual({
      accessToken: "new-access-token",
      idToken: "new-id-token",
      accessTokenExpires: 1234567890,
    });
  });

  it("[Success] トークンがnullの場合も正しく処理される", async () => {
    mockRefreshTokens.mockResolvedValue({
      accessToken: null,
      idToken: null,
      expiryDate: null,
    });

    const result = await refreshGoogleTokenCommand({
      refreshToken: "valid-refresh-token",
    });

    expect(result).toEqual({
      accessToken: null,
      idToken: null,
      accessTokenExpires: null,
    });
  });

  it("[Fail] refreshTokenが空文字でエラーになる", async () => {
    await expect(
      refreshGoogleTokenCommand({ refreshToken: "" }),
    ).rejects.toThrow();
  });
});
