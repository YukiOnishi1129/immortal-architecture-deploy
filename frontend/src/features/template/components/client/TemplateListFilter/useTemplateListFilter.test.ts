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
  usePathname: () => "/templates",
  useSearchParams: () => ({
    get: mockGet,
    toString: mockSearchParamsToString,
  }),
}));

import { useTemplateListFilter } from "./useTemplateListFilter";

describe("useTemplateListFilter", () => {
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
      const { result } = renderHook(() => useTemplateListFilter());

      expect(result.current.searchQuery).toBe("");
      expect(result.current.onlyMyTemplates).toBe(false);
      expect(result.current.isPending).toBe(false);
    });

    it("[Success] URLパラメータからqを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "q") return "検索クエリ";
        return null;
      });

      const { result } = renderHook(() => useTemplateListFilter());

      expect(result.current.searchQuery).toBe("検索クエリ");
    });

    it("[Success] URLパラメータからonlyMyTemplatesを取得する", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "onlyMyTemplates") return "true";
        return null;
      });

      const { result } = renderHook(() => useTemplateListFilter());

      expect(result.current.onlyMyTemplates).toBe(true);
    });

    it("[Success] onlyMyTemplatesがtrue以外の場合はfalse", () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "onlyMyTemplates") return "false";
        return null;
      });

      const { result } = renderHook(() => useTemplateListFilter());

      expect(result.current.onlyMyTemplates).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // setSearchQuery
  // ---------------------------------------------------------------------------
  describe("setSearchQuery", () => {
    it("[Success] 検索クエリを更新できる", () => {
      const { result } = renderHook(() => useTemplateListFilter());

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
      const { result } = renderHook(() => useTemplateListFilter());

      act(() => {
        result.current.setSearchQuery("テスト検索");
      });

      act(() => {
        result.current.handleSearch({
          preventDefault: vi.fn(),
        } as unknown as React.FormEvent);
      });

      expect(mockPush).toHaveBeenCalledWith(
        "/templates?q=%E3%83%86%E3%82%B9%E3%83%88%E6%A4%9C%E7%B4%A2",
      );
    });

    it("[Success] 空文字で検索するとqパラメータが削除される", () => {
      mockSearchParamsToString.mockReturnValue("q=old");
      const { result } = renderHook(() => useTemplateListFilter());

      act(() => {
        result.current.setSearchQuery("");
      });

      act(() => {
        result.current.handleSearch({
          preventDefault: vi.fn(),
        } as unknown as React.FormEvent);
      });

      expect(mockPush).toHaveBeenCalledWith("/templates?");
    });
  });

  // ---------------------------------------------------------------------------
  // handleOnlyMyTemplatesChange
  // ---------------------------------------------------------------------------
  describe("handleOnlyMyTemplatesChange", () => {
    it("[Success] trueに変更するとパラメータが追加される", () => {
      mockSearchParamsToString.mockReturnValue("");
      const { result } = renderHook(() => useTemplateListFilter());

      act(() => {
        result.current.handleOnlyMyTemplatesChange(true);
      });

      expect(result.current.onlyMyTemplates).toBe(true);
      expect(mockPush).toHaveBeenCalledWith("/templates?onlyMyTemplates=true");
    });

    it("[Success] falseに変更するとパラメータが削除される", () => {
      mockSearchParamsToString.mockReturnValue("onlyMyTemplates=true");
      mockGet.mockImplementation((key: string) => {
        if (key === "onlyMyTemplates") return "true";
        return null;
      });

      const { result } = renderHook(() => useTemplateListFilter());

      act(() => {
        result.current.handleOnlyMyTemplatesChange(false);
      });

      expect(result.current.onlyMyTemplates).toBe(false);
      expect(mockPush).toHaveBeenCalledWith("/templates?");
    });

    it("[Success] 変更時にpageパラメータがリセットされる", () => {
      mockSearchParamsToString.mockReturnValue("page=3");
      const { result } = renderHook(() => useTemplateListFilter());

      act(() => {
        result.current.handleOnlyMyTemplatesChange(true);
      });

      expect(mockPush).toHaveBeenCalledWith("/templates?onlyMyTemplates=true");
    });
  });
});
