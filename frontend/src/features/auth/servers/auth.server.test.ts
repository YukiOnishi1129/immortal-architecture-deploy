import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// next/headers モック
const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

// better-auth モック
const mockGetSession = vi.fn();
vi.mock("@/features/auth/lib/better-auth", () => ({
  auth: {
    api: {
      getSession: (params: unknown) => mockGetSession(params),
    },
  },
}));

import { getSessionServer } from "./auth.server";

describe("auth.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getSessionServer
  // ---------------------------------------------------------------------------
  describe("getSessionServer", () => {
    it("[Success] セッションを返す", async () => {
      const mockHeadersValue = new Headers({ cookie: "session=abc123" });
      mockHeaders.mockResolvedValue(mockHeadersValue);

      const mockSession = {
        account: { id: "account-1" },
        user: { id: "user-1", email: "test@example.com" },
        session: { id: "session-1" },
      };
      mockGetSession.mockResolvedValue(mockSession);

      const result = await getSessionServer();

      expect(result).toEqual(mockSession);
      expect(mockGetSession).toHaveBeenCalledWith({
        headers: mockHeadersValue,
      });
    });

    it("[Success] セッションがない場合nullを返す", async () => {
      const mockHeadersValue = new Headers();
      mockHeaders.mockResolvedValue(mockHeadersValue);
      mockGetSession.mockResolvedValue(null);

      const result = await getSessionServer();

      expect(result).toBeNull();
    });

    it("[Success] headersがauth.api.getSessionに渡される", async () => {
      const mockHeadersValue = new Headers({
        cookie: "auth_token=xyz789",
        "user-agent": "test-agent",
      });
      mockHeaders.mockResolvedValue(mockHeadersValue);
      mockGetSession.mockResolvedValue(null);

      await getSessionServer();

      expect(mockGetSession).toHaveBeenCalledWith({
        headers: mockHeadersValue,
      });
    });
  });
});
