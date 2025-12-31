import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// useNoteListQuery モック
const mockUseNoteListQuery = vi.fn();
vi.mock("@/features/note/hooks/useNoteListQuery", () => ({
  useNoteListQuery: (filters: unknown) => mockUseNoteListQuery(filters),
}));

import { useNoteList } from "./useNoteList";

describe("useNoteList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockUseNoteListQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  // ---------------------------------------------------------------------------
  // filters
  // ---------------------------------------------------------------------------
  describe("filters", () => {
    it("[Success] デフォルトのフィルタが設定される", () => {
      const { result } = renderHook(() => useNoteList());

      expect(result.current.filters).toEqual({
        q: undefined,
        status: "Publish",
        page: 1,
      });
    });

    it("[Success] URLパラメータからqを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索";
        return null;
      });

      const { result } = renderHook(() => useNoteList());

      expect(result.current.filters.q).toBe("検索");
    });

    it("[Success] URLパラメータからpageを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "page") return "3";
        return null;
      });

      const { result } = renderHook(() => useNoteList());

      expect(result.current.filters.page).toBe(3);
    });

    it("[Success] initialFiltersからqを取得する", () => {
      const { result } = renderHook(() => useNoteList({ q: "初期検索" }));

      expect(result.current.filters.q).toBe("初期検索");
    });

    it("[Success] initialFiltersからpageを取得する", () => {
      const { result } = renderHook(() => useNoteList({ page: 5 }));

      expect(result.current.filters.page).toBe(5);
    });

    it("[Success] URLパラメータがinitialFiltersより優先される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "URL検索";
        return null;
      });

      const { result } = renderHook(() => useNoteList({ q: "初期検索" }));

      expect(result.current.filters.q).toBe("URL検索");
    });

    it("[Success] statusは常にPublishになる", () => {
      const { result } = renderHook(() =>
        useNoteList({ status: "Draft" as const }),
      );

      expect(result.current.filters.status).toBe("Publish");
    });
  });

  // ---------------------------------------------------------------------------
  // notes
  // ---------------------------------------------------------------------------
  describe("notes", () => {
    it("[Success] クエリ結果を返す", () => {
      const mockNotes = [
        { id: "1", title: "ノート1" },
        { id: "2", title: "ノート2" },
      ];
      mockUseNoteListQuery.mockReturnValue({
        data: mockNotes,
        isLoading: false,
      });

      const { result } = renderHook(() => useNoteList());

      expect(result.current.notes).toEqual(mockNotes);
    });

    it("[Success] dataがnullの場合は空配列を返す", () => {
      mockUseNoteListQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useNoteList());

      expect(result.current.notes).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isLoading
  // ---------------------------------------------------------------------------
  describe("isLoading", () => {
    it("[Success] ローディング中はtrueを返す", () => {
      mockUseNoteListQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useNoteList());

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] ローディング完了後はfalseを返す", () => {
      mockUseNoteListQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      const { result } = renderHook(() => useNoteList());

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // useNoteListQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useNoteListQuery呼び出し", () => {
    it("[Success] 正しいフィルタで呼び出される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索";
        if (key === "page") return "2";
        return null;
      });

      renderHook(() => useNoteList());

      expect(mockUseNoteListQuery).toHaveBeenCalledWith({
        q: "検索",
        status: "Publish",
        page: 2,
      });
    });
  });
});
