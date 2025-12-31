import { beforeEach, describe, expect, it, vi } from "vitest";

// Google Auth クライアントモック
vi.mock("@/external/client/google-auth/client", () => ({
  getGoogleOAuth2Client: vi.fn(),
}));

import { getGoogleOAuth2Client } from "@/external/client/google-auth/client";
import { TokenVerificationService } from "./token-verification.service";

// =============================================================================
// TokenVerificationService
// =============================================================================
describe("TokenVerificationService", () => {
  let service: TokenVerificationService;
  let mockOAuth2Client: {
    verifyIdToken: ReturnType<typeof vi.fn>;
    setCredentials: ReturnType<typeof vi.fn>;
    refreshAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockOAuth2Client = {
      verifyIdToken: vi.fn(),
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn(),
    };
    vi.mocked(getGoogleOAuth2Client).mockReturnValue(
      mockOAuth2Client as unknown as ReturnType<typeof getGoogleOAuth2Client>,
    );
    service = new TokenVerificationService();
  });

  // ---------------------------------------------------------------------------
  // verifyIdToken
  // ---------------------------------------------------------------------------
  describe("verifyIdToken", () => {
    it("[Success] 有効なトークンを検証できる", async () => {
      const mockPayload = {
        sub: "user-123",
        email: "test@example.com",
        email_verified: true,
        name: "山田 太郎",
        picture: "https://example.com/avatar.jpg",
      };
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      });

      const result = await service.verifyIdToken("valid-id-token");

      expect(result).toEqual({
        userId: "user-123",
        email: "test@example.com",
        emailVerified: true,
        name: "山田 太郎",
        picture: "https://example.com/avatar.jpg",
        isValid: true,
      });
    });

    it("[Fail] payloadがnullの場合はエラーになる", async () => {
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => null,
      });

      await expect(service.verifyIdToken("invalid-token")).rejects.toThrow(
        "Invalid ID token",
      );
    });

    it("[Fail] 検証に失敗した場合はエラーになる", async () => {
      mockOAuth2Client.verifyIdToken.mockRejectedValue(
        new Error("Verification failed"),
      );

      await expect(service.verifyIdToken("invalid-token")).rejects.toThrow(
        "Invalid ID token",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // refreshTokens
  // ---------------------------------------------------------------------------
  describe("refreshTokens", () => {
    it("[Success] トークンをリフレッシュできる", async () => {
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: "new-access-token",
          id_token: "new-id-token",
          expiry_date: 1234567890,
        },
      });

      const result = await service.refreshTokens("valid-refresh-token");

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: "valid-refresh-token",
      });
      expect(result).toEqual({
        accessToken: "new-access-token",
        idToken: "new-id-token",
        expiryDate: 1234567890,
      });
    });

    it("[Fail] リフレッシュに失敗した場合はエラーになる", async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error("Refresh failed"),
      );

      await expect(service.refreshTokens("invalid-token")).rejects.toThrow(
        "Failed to refresh tokens",
      );
    });
  });
});
