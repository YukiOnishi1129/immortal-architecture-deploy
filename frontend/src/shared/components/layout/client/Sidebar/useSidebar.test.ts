import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
let mockPathname = "/notes";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { useSidebar } from "./useSidebar";

describe("useSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/notes";
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] isOpenは初期状態でfalse", () => {
      const { result } = renderHook(() => useSidebar());

      expect(result.current.isOpen).toBe(false);
    });

    it("[Success] pathnameが正しく返される", () => {
      mockPathname = "/templates";

      const { result } = renderHook(() => useSidebar());

      expect(result.current.pathname).toBe("/templates");
    });
  });

  // ---------------------------------------------------------------------------
  // handleToggle
  // ---------------------------------------------------------------------------
  describe("handleToggle", () => {
    it("[Success] トグルでisOpenがtrueになる", () => {
      const { result } = renderHook(() => useSidebar());

      act(() => {
        result.current.handleToggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it("[Success] 再度トグルでisOpenがfalseになる", () => {
      const { result } = renderHook(() => useSidebar());

      act(() => {
        result.current.handleToggle();
      });

      act(() => {
        result.current.handleToggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it("[Success] 連続トグルで状態が切り替わる", () => {
      const { result } = renderHook(() => useSidebar());

      // false -> true
      act(() => {
        result.current.handleToggle();
      });
      expect(result.current.isOpen).toBe(true);

      // true -> false
      act(() => {
        result.current.handleToggle();
      });
      expect(result.current.isOpen).toBe(false);

      // false -> true
      act(() => {
        result.current.handleToggle();
      });
      expect(result.current.isOpen).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // pathname変更時の動作
  // ---------------------------------------------------------------------------
  describe("pathname変更時", () => {
    it("[Success] pathname変更でisOpenがfalseになる", () => {
      const { result, rerender } = renderHook(() => useSidebar());

      // サイドバーを開く
      act(() => {
        result.current.handleToggle();
      });
      expect(result.current.isOpen).toBe(true);

      // pathnameを変更して再レンダリング
      mockPathname = "/templates";
      rerender();

      expect(result.current.isOpen).toBe(false);
    });

    it("[Success] 同じpathnameでは状態が維持される", () => {
      const { result, rerender } = renderHook(() => useSidebar());

      // サイドバーを開く
      act(() => {
        result.current.handleToggle();
      });
      expect(result.current.isOpen).toBe(true);

      // 同じpathnameで再レンダリング
      rerender();

      expect(result.current.isOpen).toBe(true);
    });
  });
});
