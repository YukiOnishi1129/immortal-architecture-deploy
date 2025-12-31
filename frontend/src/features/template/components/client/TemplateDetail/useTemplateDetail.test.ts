import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// useTemplateQuery モック
const mockUseTemplateQuery = vi.fn();
vi.mock("@/features/template/hooks/useTemplateQuery", () => ({
  useTemplateQuery: (templateId: string) => mockUseTemplateQuery(templateId),
}));

// Server Action モック
const mockDeleteTemplateCommandAction = vi.fn();
vi.mock("@/external/handler/template/template.command.action", () => ({
  deleteTemplateCommandAction: (params: unknown) =>
    mockDeleteTemplateCommandAction(params),
}));

// toast モック - vi.hoisted を使用
const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { useTemplateDetail } from "./useTemplateDetail";

describe("useTemplateDetail", () => {
  const mockTemplate = {
    id: "template-1",
    name: "テストテンプレート",
    fields: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseTemplateQuery.mockReturnValue({
      data: mockTemplate,
      isLoading: false,
      error: null,
    });
    mockDeleteTemplateCommandAction.mockResolvedValue({ success: true });
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] テンプレートデータを返す", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      expect(result.current.template).toEqual(mockTemplate);
    });

    it("[Success] ローディング状態を返す", () => {
      mockUseTemplateQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { result } = renderHook(() => useTemplateDetail("template-1"));

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] エラー状態を返す", () => {
      const mockError = new Error("テスト エラー");
      mockUseTemplateQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError,
      });

      const { result } = renderHook(() => useTemplateDetail("template-1"));

      expect(result.current.error).toBe(mockError);
    });

    it("[Success] 削除モーダルは初期状態で閉じている", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      expect(result.current.showDeleteModal).toBe(false);
    });

    it("[Success] isDeletingは初期状態でfalse", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      expect(result.current.isDeleting).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleEdit
  // ---------------------------------------------------------------------------
  describe("handleEdit", () => {
    it("[Success] 編集ページに遷移する", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      act(() => {
        result.current.handleEdit();
      });

      expect(mockPush).toHaveBeenCalledWith("/templates/template-1/edit");
    });
  });

  // ---------------------------------------------------------------------------
  // handleCreateNote
  // ---------------------------------------------------------------------------
  describe("handleCreateNote", () => {
    it("[Success] ノート作成ページに遷移する", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      act(() => {
        result.current.handleCreateNote();
      });

      expect(mockPush).toHaveBeenCalledWith("/notes/new?templateId=template-1");
    });
  });

  // ---------------------------------------------------------------------------
  // 削除モーダル
  // ---------------------------------------------------------------------------
  describe("削除モーダル", () => {
    it("[Success] handleDeleteClickでモーダルを開く", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      act(() => {
        result.current.handleDeleteClick();
      });

      expect(result.current.showDeleteModal).toBe(true);
    });

    it("[Success] handleDeleteCancelでモーダルを閉じる", () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      act(() => {
        result.current.handleDeleteClick();
      });

      act(() => {
        result.current.handleDeleteCancel();
      });

      expect(result.current.showDeleteModal).toBe(false);
    });

    it("[Success] handleDeleteConfirmで削除が成功するとテンプレート一覧に遷移", async () => {
      const { result } = renderHook(() => useTemplateDetail("template-1"));

      act(() => {
        result.current.handleDeleteClick();
      });

      await act(async () => {
        result.current.handleDeleteConfirm();
      });

      expect(mockDeleteTemplateCommandAction).toHaveBeenCalledWith({
        id: "template-1",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "テンプレートを削除しました",
      );
      expect(mockPush).toHaveBeenCalledWith("/templates");
      expect(result.current.showDeleteModal).toBe(false);
    });

    it("[Fail] handleDeleteConfirmで削除に失敗するとエラートーストを表示", async () => {
      mockDeleteTemplateCommandAction.mockRejectedValue(
        new Error("削除エラー"),
      );

      const { result } = renderHook(() => useTemplateDetail("template-1"));

      act(() => {
        result.current.handleDeleteClick();
      });

      await act(async () => {
        result.current.handleDeleteConfirm();
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "テンプレートの削除に失敗しました",
      );
      expect(result.current.showDeleteModal).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // useTemplateQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useTemplateQuery呼び出し", () => {
    it("[Success] templateIdで呼び出される", () => {
      renderHook(() => useTemplateDetail("template-123"));

      expect(mockUseTemplateQuery).toHaveBeenCalledWith("template-123");
    });
  });
});
