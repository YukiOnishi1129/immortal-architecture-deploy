import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// getAuthenticatedSessionServer モック
const mockGetAuthenticatedSessionServer = vi.fn();
vi.mock("@/features/auth/servers/redirect.server", () => ({
  getAuthenticatedSessionServer: () => mockGetAuthenticatedSessionServer(),
}));

import { withAuth } from "./auth.guard";

describe("auth.guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // withAuth
  // ---------------------------------------------------------------------------
  describe("withAuth", () => {
    it("[Success] 認証済みの場合ハンドラーを実行する", async () => {
      mockGetAuthenticatedSessionServer.mockResolvedValue({
        account: { id: "account-123" },
      });

      const handler = vi.fn().mockResolvedValue("result");

      const result = await withAuth(handler);

      expect(handler).toHaveBeenCalledWith({ accountId: "account-123" });
      expect(result).toBe("result");
    });

    it("[Success] ハンドラーにaccountIdが渡される", async () => {
      mockGetAuthenticatedSessionServer.mockResolvedValue({
        account: { id: "user-456" },
      });

      const handler = vi.fn().mockImplementation(({ accountId }) => {
        return `Account: ${accountId}`;
      });

      const result = await withAuth(handler);

      expect(result).toBe("Account: user-456");
    });

    it("[Success] ハンドラーの戻り値をそのまま返す", async () => {
      mockGetAuthenticatedSessionServer.mockResolvedValue({
        account: { id: "account-1" },
      });

      const handler = vi.fn().mockResolvedValue({
        data: [1, 2, 3],
        count: 3,
      });

      const result = await withAuth(handler);

      expect(result).toEqual({
        data: [1, 2, 3],
        count: 3,
      });
    });

    it("[Fail] ハンドラーがエラーを投げた場合そのままスローされる", async () => {
      mockGetAuthenticatedSessionServer.mockResolvedValue({
        account: { id: "account-1" },
      });

      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));

      await expect(withAuth(handler)).rejects.toThrow("Handler error");
    });
  });
});
