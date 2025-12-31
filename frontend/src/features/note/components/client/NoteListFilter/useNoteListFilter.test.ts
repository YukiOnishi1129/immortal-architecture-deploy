import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockPush = vi.fn();
const mockGet = vi.fn();
const mockSearchParamsToString = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/notes",
  useSearchParams: () => ({
    get: mockGet,
    toString: mockSearchParamsToString,
  }),
}));

import { useNoteListFilter } from "./useNoteListFilter";

describe("useNoteListFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockSearchParamsToString.mockReturnValue("");
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] デフォルト値で初期化される", () => {
      const { result } = renderHook(() => useNoteListFilter());

      expect(result.current.searchQuery).toBe("");
      expect(result.current.statusFilter).toBe("all");
      expect(result.current.isPending).toBe(false);
    });

    it("[Success] URLパラメータから初期化される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索クエリ";
        if (key === "status") return "publish";
        return null;
      });

      const { result } = renderHook(() => useNoteListFilter());

      expect(result.current.searchQuery).toBe("検索クエリ");
      expect(result.current.statusFilter).toBe("publish");
    });

    it("[Success] initialFiltersから初期化される", () => {
      const { result } = renderHook(() =>
        useNoteListFilter({ q: "初期検索", status: "draft" }),
      );

      expect(result.current.searchQuery).toBe("初期検索");
      expect(result.current.statusFilter).toBe("draft");
    });

    it("[Success] URLパラメータがinitialFiltersより優先される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "URL検索";
        return null;
      });

      const { result } = renderHook(() => useNoteListFilter({ q: "初期検索" }));

      expect(result.current.searchQuery).toBe("URL検索");
    });
  });

  // ---------------------------------------------------------------------------
  // setSearchQuery
  // ---------------------------------------------------------------------------
  describe("setSearchQuery", () => {
    it("[Success] 検索クエリを更新できる", () => {
      const { result } = renderHook(() => useNoteListFilter());

      act(() => {
        result.current.setSearchQuery("新しいクエリ");
      });

      expect(result.current.searchQuery).toBe("新しいクエリ");
    });
  });

  // ---------------------------------------------------------------------------
  // handleSearch
  // ---------------------------------------------------------------------------
  describe("handleSearch", () => {
    it("[Success] 検索を実行するとルーターにpushされる", () => {
      mockSearchParamsToString.mockReturnValue("");
      const { result } = renderHook(() => useNoteListFilter());

      act(() => {
        result.current.setSearchQuery("テスト検索");
      });

      act(() => {
        result.current.handleSearch({
          preventDefault: vi.fn(),
        } as unknown as React.FormEvent);
      });

      expect(mockPush).toHaveBeenCalledWith(
        "/notes?q=%E3%83%86%E3%82%B9%E3%83%88%E6%A4%9C%E7%B4%A2",
      );
    });

    it("[Success] 空文字で検索するとqパラメータが削除される", () => {
      mockSearchParamsToString.mockReturnValue("q=old");
      const { result } = renderHook(() => useNoteListFilter());

      act(() => {
        result.current.setSearchQuery("");
      });

      act(() => {
        result.current.handleSearch({
          preventDefault: vi.fn(),
        } as unknown as React.FormEvent);
      });

      expect(mockPush).toHaveBeenCalledWith("/notes?");
    });
  });

  // ---------------------------------------------------------------------------
  // handleStatusChange
  // ---------------------------------------------------------------------------
  describe("handleStatusChange", () => {
    it("[Success] ステータスを変更するとルーターにpushされる", () => {
      mockSearchParamsToString.mockReturnValue("");
      const { result } = renderHook(() => useNoteListFilter());

      act(() => {
        result.current.handleStatusChange("publish");
      });

      expect(mockPush).toHaveBeenCalledWith("/notes?status=publish");
    });

    it("[Success] allを選択するとstatusパラメータが削除される", () => {
      mockSearchParamsToString.mockReturnValue("status=publish");
      const { result } = renderHook(() => useNoteListFilter());

      act(() => {
        result.current.handleStatusChange("all");
      });

      expect(mockPush).toHaveBeenCalledWith("/notes?");
    });

    it("[Success] ステータス変更時にpageパラメータがリセットされる", () => {
      mockSearchParamsToString.mockReturnValue("page=3");
      const { result } = renderHook(() => useNoteListFilter());

      act(() => {
        result.current.handleStatusChange("draft");
      });

      expect(mockPush).toHaveBeenCalledWith("/notes?status=draft");
    });
  });
});
