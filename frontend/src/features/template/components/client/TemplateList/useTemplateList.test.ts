import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// useTemplateListQuery モック
const mockUseTemplateListQuery = vi.fn();
vi.mock("@/features/template/hooks/useTemplateQuery", () => ({
  useTemplateListQuery: (filters: unknown) => mockUseTemplateListQuery(filters),
}));

import { useTemplateList } from "./useTemplateList";

describe("useTemplateList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockUseTemplateListQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  // ---------------------------------------------------------------------------
  // filters
  // ---------------------------------------------------------------------------
  describe("filters", () => {
    it("[Success] デフォルトのフィルタが設定される", () => {
      const { result } = renderHook(() => useTemplateList());

      expect(result.current.filters).toEqual({
        q: undefined,
        page: 1,
        onlyMyTemplates: undefined,
      });
    });

    it("[Success] URLパラメータからqを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索";
        return null;
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.filters.q).toBe("検索");
    });

    it("[Success] URLパラメータからpageを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "page") return "3";
        return null;
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.filters.page).toBe(3);
    });

    it("[Success] URLパラメータからonlyMyTemplatesを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "onlyMyTemplates") return "true";
        return null;
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.filters.onlyMyTemplates).toBe(true);
    });

    it("[Success] initialFiltersからqを取得する", () => {
      const { result } = renderHook(() => useTemplateList({ q: "初期検索" }));

      expect(result.current.filters.q).toBe("初期検索");
    });

    it("[Success] initialFiltersからpageを取得する", () => {
      const { result } = renderHook(() => useTemplateList({ page: 5 }));

      expect(result.current.filters.page).toBe(5);
    });

    it("[Success] initialFiltersからonlyMyTemplatesを取得する", () => {
      const { result } = renderHook(() =>
        useTemplateList({ onlyMyTemplates: true }),
      );

      expect(result.current.filters.onlyMyTemplates).toBe(true);
    });

    it("[Success] URLパラメータがinitialFiltersより優先される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "URL検索";
        return null;
      });

      const { result } = renderHook(() => useTemplateList({ q: "初期検索" }));

      expect(result.current.filters.q).toBe("URL検索");
    });
  });

  // ---------------------------------------------------------------------------
  // templates
  // ---------------------------------------------------------------------------
  describe("templates", () => {
    it("[Success] クエリ結果を返す", () => {
      const mockTemplates = [
        { id: "1", name: "テンプレート1" },
        { id: "2", name: "テンプレート2" },
      ];
      mockUseTemplateListQuery.mockReturnValue({
        data: mockTemplates,
        isLoading: false,
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.templates).toEqual(mockTemplates);
    });

    it("[Success] dataがnullの場合は空配列を返す", () => {
      mockUseTemplateListQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.templates).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isLoading
  // ---------------------------------------------------------------------------
  describe("isLoading", () => {
    it("[Success] ローディング中はtrueを返す", () => {
      mockUseTemplateListQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] ローディング完了後はfalseを返す", () => {
      mockUseTemplateListQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      const { result } = renderHook(() => useTemplateList());

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // useTemplateListQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useTemplateListQuery呼び出し", () => {
    it("[Success] 正しいフィルタで呼び出される", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索";
        if (key === "page") return "2";
        if (key === "onlyMyTemplates") return "true";
        return null;
      });

      renderHook(() => useTemplateList());

      expect(mockUseTemplateListQuery).toHaveBeenCalledWith({
        q: "検索",
        page: 2,
        onlyMyTemplates: true,
      });
    });
  });
});
