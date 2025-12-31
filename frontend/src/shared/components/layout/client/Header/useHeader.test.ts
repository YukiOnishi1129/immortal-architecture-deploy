import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// React Query モック
const mockClear = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    clear: mockClear,
  }),
}));

// better-auth-client モック - vi.hoisted使用
const { mockSignOut, mockUseSession } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockUseSession: vi.fn(),
}));

vi.mock("@/features/auth/lib/better-auth-client", () => ({
  signOut: mockSignOut,
  useSession: mockUseSession,
}));

import { useHeader } from "./useHeader";

describe("useHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
      data: null,
    });
  });

  // ---------------------------------------------------------------------------
  // セッションなし
  // ---------------------------------------------------------------------------
  describe("セッションなし", () => {
    it("[Success] セッションがない場合はundefinedを返す", () => {
      mockUseSession.mockReturnValue({ data: null });

      const { result } = renderHook(() => useHeader());

      expect(result.current.userName).toBeUndefined();
      expect(result.current.userEmail).toBeUndefined();
      expect(result.current.userImage).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // セッションあり（基本情報）
  // ---------------------------------------------------------------------------
  describe("セッションあり", () => {
    it("[Success] ユーザー名を返す", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: "山田太郎",
            email: "taro@example.com",
            image: "https://example.com/avatar.jpg",
          },
        },
      });

      const { result } = renderHook(() => useHeader());

      expect(result.current.userName).toBe("山田太郎");
    });

    it("[Success] メールアドレスを返す", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: "山田太郎",
            email: "taro@example.com",
          },
        },
      });

      const { result } = renderHook(() => useHeader());

      expect(result.current.userEmail).toBe("taro@example.com");
    });

    it("[Success] user.imageを返す", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: "山田太郎",
            email: "taro@example.com",
            image: "https://example.com/user-avatar.jpg",
          },
        },
      });

      const { result } = renderHook(() => useHeader());

      expect(result.current.userImage).toBe(
        "https://example.com/user-avatar.jpg",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // セッションあり（カスタムaccount.thumbnail）
  // ---------------------------------------------------------------------------
  describe("カスタムセッション", () => {
    it("[Success] account.thumbnailがuser.imageより優先される", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: "山田太郎",
            email: "taro@example.com",
            image: "https://example.com/user-avatar.jpg",
          },
          account: {
            thumbnail: "https://example.com/account-thumbnail.jpg",
          },
        },
      });

      const { result } = renderHook(() => useHeader());

      expect(result.current.userImage).toBe(
        "https://example.com/account-thumbnail.jpg",
      );
    });

    it("[Success] account.thumbnailがnullの場合はuser.imageを使用", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: "山田太郎",
            email: "taro@example.com",
            image: "https://example.com/user-avatar.jpg",
          },
          account: {
            thumbnail: null,
          },
        },
      });

      const { result } = renderHook(() => useHeader());

      expect(result.current.userImage).toBe(
        "https://example.com/user-avatar.jpg",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleSignOut
  // ---------------------------------------------------------------------------
  describe("handleSignOut", () => {
    it("[Success] signOutを呼び出す", async () => {
      mockUseSession.mockReturnValue({ data: null });

      const { result } = renderHook(() => useHeader());

      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("[Success] キャッシュをクリアする", async () => {
      mockUseSession.mockReturnValue({ data: null });

      const { result } = renderHook(() => useHeader());

      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(mockClear).toHaveBeenCalled();
    });

    it("[Success] ログインページにリダイレクトする", async () => {
      mockUseSession.mockReturnValue({ data: null });

      const { result } = renderHook(() => useHeader());

      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("[Success] 正しい順序で実行される", async () => {
      mockUseSession.mockReturnValue({ data: null });
      const callOrder: string[] = [];

      mockSignOut.mockImplementation(async () => {
        callOrder.push("signOut");
      });
      mockClear.mockImplementation(() => {
        callOrder.push("clear");
      });
      mockPush.mockImplementation(() => {
        callOrder.push("push");
      });

      const { result } = renderHook(() => useHeader());

      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(callOrder).toEqual(["signOut", "clear", "push"]);
    });
  });
});
