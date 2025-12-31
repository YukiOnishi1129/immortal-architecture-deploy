import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// useMyNoteListQuery モック
const mockUseMyNoteListQuery = vi.fn();
vi.mock("@/features/note/hooks/useMyNoteListQuery", () => ({
  useMyNoteListQuery: (filters: unknown) => mockUseMyNoteListQuery(filters),
}));

import { useMyNoteList } from "./useMyNoteList";

describe("useMyNoteList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockUseMyNoteListQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  // ---------------------------------------------------------------------------
  // filters
  // ---------------------------------------------------------------------------
  describe("filters", () => {
    it("[Success] initialFiltersがそのまま使われる", () => {
      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { ownerId: "user-1", page: 1 },
        }),
      );

      expect(result.current.filters.ownerId).toBe("user-1");
      expect(result.current.filters.page).toBe(1);
    });

    it("[Success] URLパラメータからstatusを取得する (Draft)", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "status") return "Draft";
        return null;
      });

      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { status: "Publish" },
        }),
      );

      expect(result.current.filters.status).toBe("Draft");
    });

    it("[Success] URLパラメータからstatusを取得する (Publish)", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "status") return "Publish";
        return null;
      });

      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { status: "Draft" },
        }),
      );

      expect(result.current.filters.status).toBe("Publish");
    });

    it("[Success] 無効なstatusの場合はinitialFiltersを使用", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "status") return "invalid";
        return null;
      });

      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { status: "Draft" },
        }),
      );

      expect(result.current.filters.status).toBe("Draft");
    });

    it("[Success] URLパラメータからqを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索";
        return null;
      });

      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { q: "初期検索" },
        }),
      );

      expect(result.current.filters.q).toBe("検索");
    });

    it("[Success] URLパラメータからpageを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "page") return "3";
        return null;
      });

      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { page: 1 },
        }),
      );

      expect(result.current.filters.page).toBe(3);
    });

    it("[Success] qがnullの場合initialFiltersを使用", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() =>
        useMyNoteList({
          initialFilters: { q: "初期検索" },
        }),
      );

      expect(result.current.filters.q).toBe("初期検索");
    });
  });

  // ---------------------------------------------------------------------------
  // notes
  // ---------------------------------------------------------------------------
  describe("notes", () => {
    it("[Success] クエリ結果を返す", () => {
      const mockNotes = [
        { id: "1", title: "マイノート1" },
        { id: "2", title: "マイノート2" },
      ];
      mockUseMyNoteListQuery.mockReturnValue({
        data: mockNotes,
        isLoading: false,
      });

      const { result } = renderHook(() =>
        useMyNoteList({ initialFilters: {} }),
      );

      expect(result.current.notes).toEqual(mockNotes);
    });

    it("[Success] dataがnullの場合は空配列を返す", () => {
      mockUseMyNoteListQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { result } = renderHook(() =>
        useMyNoteList({ initialFilters: {} }),
      );

      expect(result.current.notes).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isLoading
  // ---------------------------------------------------------------------------
  describe("isLoading", () => {
    it("[Success] ローディング中はtrueを返す", () => {
      mockUseMyNoteListQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() =>
        useMyNoteList({ initialFilters: {} }),
      );

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] ローディング完了後はfalseを返す", () => {
      mockUseMyNoteListQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      const { result } = renderHook(() =>
        useMyNoteList({ initialFilters: {} }),
      );

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // useMyNoteListQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useMyNoteListQuery呼び出し", () => {
    it("[Success] 正しいフィルタで呼び出される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索";
        if (key === "page") return "2";
        if (key === "status") return "Draft";
        return null;
      });

      renderHook(() =>
        useMyNoteList({
          initialFilters: { ownerId: "user-1" },
        }),
      );

      expect(mockUseMyNoteListQuery).toHaveBeenCalledWith({
        ownerId: "user-1",
        status: "Draft",
        q: "検索",
        page: 2,
      });
    });
  });
});
