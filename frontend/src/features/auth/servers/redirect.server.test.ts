import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// vi.hoistedを使用してモック関数を定義
const { mockRedirect, mockGetSessionServer } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetSessionServer: vi.fn(),
}));

// next/navigation モック
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// getSessionServer モック
vi.mock("@/features/auth/servers/auth.server", () => ({
  getSessionServer: () => mockGetSessionServer(),
}));

import {
  getAuthenticatedSessionServer,
  redirectIfAuthenticatedServer,
  requireAuthServer,
} from "./redirect.server";

describe("redirect.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // requireAuthServer
  // ---------------------------------------------------------------------------
  describe("requireAuthServer", () => {
    it("[Success] セッションがある場合リダイレクトしない", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: { id: "account-1" },
      });

      await requireAuthServer();

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("[Fail] セッションがない場合/loginにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue(null);

      await requireAuthServer();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("[Fail] accountがない場合/loginにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: null,
      });

      await requireAuthServer();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("[Fail] errorがある場合/loginにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: { id: "account-1" },
        error: "Some error",
      });

      await requireAuthServer();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // getAuthenticatedSessionServer
  // ---------------------------------------------------------------------------
  describe("getAuthenticatedSessionServer", () => {
    it("[Success] 認証済みセッションを返す", async () => {
      const mockSession = {
        account: { id: "account-1", firstName: "太郎" },
        user: { id: "user-1", email: "test@example.com", name: "山田太郎" },
        session: { id: "session-1", userId: "user-1", expiresAt: new Date() },
      };
      mockGetSessionServer.mockResolvedValue(mockSession);

      const result = await getAuthenticatedSessionServer();

      expect(result).toEqual(mockSession);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("[Fail] セッションがない場合/loginにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue(null);

      await getAuthenticatedSessionServer();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("[Fail] accountがない場合/loginにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: null,
        user: { id: "user-1" },
      });

      await getAuthenticatedSessionServer();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("[Fail] errorがある場合/loginにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: { id: "account-1" },
        error: "Token expired",
      });

      await getAuthenticatedSessionServer();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  // ---------------------------------------------------------------------------
  // redirectIfAuthenticatedServer
  // ---------------------------------------------------------------------------
  describe("redirectIfAuthenticatedServer", () => {
    it("[Success] 認証済みの場合/notesにリダイレクト", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: { id: "account-1" },
      });

      await redirectIfAuthenticatedServer();

      expect(mockRedirect).toHaveBeenCalledWith("/notes");
    });

    it("[Success] セッションがない場合リダイレクトしない", async () => {
      mockGetSessionServer.mockResolvedValue(null);

      await redirectIfAuthenticatedServer();

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("[Success] accountがない場合リダイレクトしない", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: null,
      });

      await redirectIfAuthenticatedServer();

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("[Success] errorがある場合リダイレクトしない", async () => {
      mockGetSessionServer.mockResolvedValue({
        account: { id: "account-1" },
        error: "Some error",
      });

      await redirectIfAuthenticatedServer();

      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
