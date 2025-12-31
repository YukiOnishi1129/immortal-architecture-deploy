import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

import { useNoteNavigation } from "./useNoteNavigation";

describe("useNoteNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  // ---------------------------------------------------------------------------
  // isFromMyNotes
  // ---------------------------------------------------------------------------
  describe("isFromMyNotes", () => {
    it("[Success] fromがmy-notesの場合trueを返す", () => {
      mockGet.mockReturnValue("my-notes");

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.isFromMyNotes).toBe(true);
    });

    it("[Success] fromがmy-notes以外の場合falseを返す", () => {
      mockGet.mockReturnValue("notes");

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.isFromMyNotes).toBe(false);
    });

    it("[Success] fromがnullの場合falseを返す", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.isFromMyNotes).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getListPath
  // ---------------------------------------------------------------------------
  describe("getListPath", () => {
    it("[Success] fromがmy-notesの場合/my-notesを返す", () => {
      mockGet.mockReturnValue("my-notes");

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.getListPath()).toBe("/my-notes");
    });

    it("[Success] fromがmy-notes以外の場合/notesを返す", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.getListPath()).toBe("/notes");
    });
  });

  // ---------------------------------------------------------------------------
  // getListLabel
  // ---------------------------------------------------------------------------
  describe("getListLabel", () => {
    it("[Success] fromがmy-notesの場合マイノートを返す", () => {
      mockGet.mockReturnValue("my-notes");

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.getListLabel()).toBe("マイノート");
    });

    it("[Success] fromがmy-notes以外の場合みんなのノートを返す", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useNoteNavigation());

      expect(result.current.getListLabel()).toBe("みんなのノート");
    });
  });

  // ---------------------------------------------------------------------------
  // getBreadcrumbItems
  // ---------------------------------------------------------------------------
  describe("getBreadcrumbItems", () => {
    it("[Success] noteTitleなしの場合、リストのみを返す", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useNoteNavigation());
      const items = result.current.getBreadcrumbItems();

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        label: "みんなのノート",
        href: "/notes",
      });
    });

    it("[Success] noteTitleありの場合、リストとタイトルを返す", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useNoteNavigation());
      const items = result.current.getBreadcrumbItems("テストノート");

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        label: "みんなのノート",
        href: "/notes",
      });
      expect(items[1]).toEqual({
        label: "テストノート",
      });
    });

    it("[Success] isEditがtrueの場合、編集を含む", () => {
      mockGet.mockReturnValue("my-notes");

      const { result } = renderHook(() => useNoteNavigation());
      const items = result.current.getBreadcrumbItems("テストノート", true);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        label: "マイノート",
        href: "/my-notes",
      });
      expect(items[1]).toEqual({
        label: "テストノート",
        href: "/notes/テストノート?from=my-notes",
      });
      expect(items[2]).toEqual({
        label: "編集",
      });
    });

    it("[Success] fromがnullでisEditがtrueの場合", () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useNoteNavigation());
      const items = result.current.getBreadcrumbItems("テストノート", true);

      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({
        label: "テストノート",
        href: "/notes/テストノート?from=",
      });
    });
  });
});
