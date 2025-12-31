import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// getSessionServer モック
const mockGetSessionServer = vi.fn();
vi.mock("@/features/auth/servers/auth.server", () => ({
  getSessionServer: () => mockGetSessionServer(),
}));

import { checkAuthAndRefreshServer } from "./auth-check.server";

describe("auth-check.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // checkAuthAndRefreshServer
  // ---------------------------------------------------------------------------
  describe("checkAuthAndRefreshServer", () => {
    it("[Success] アカウントがある場合trueを返す", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: { id: "account-1" },
      });

      const result = await checkAuthAndRefreshServer();

      expect(result).toBe(true);
    });

    it("[Success] セッションオブジェクトがある場合trueを返す", async () => {
      mockGetSessionServer.mockResolvedValue({
        user: { id: "user-1" },
      });

      const result = await checkAuthAndRefreshServer();

      expect(result).toBe(true);
    });

    it("[Fail] セッションがnullの場合falseを返す", async () => {
      mockGetSessionServer.mockResolvedValue(null);

      const result = await checkAuthAndRefreshServer();

      expect(result).toBe(false);
    });

    it("[Fail] セッションがundefinedの場合falseを返す", async () => {
      mockGetSessionServer.mockResolvedValue(undefined);

      const result = await checkAuthAndRefreshServer();

      expect(result).toBe(false);
    });

    it("[Fail] 空オブジェクトの場合trueを返す（Booleanの動作）", async () => {
      mockGetSessionServer.mockResolvedValue({});

      const result = await checkAuthAndRefreshServer();

      // 空オブジェクトはtruthyなのでtrueになる
      expect(result).toBe(true);
    });
  });
});
