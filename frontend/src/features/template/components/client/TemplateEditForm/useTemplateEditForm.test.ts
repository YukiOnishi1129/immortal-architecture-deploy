import { act, renderHook, waitFor } from "@testing-library/react";
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
const mockUpdateTemplateCommandAction = vi.fn();
vi.mock("@/external/handler/template/template.command.action", () => ({
  updateTemplateCommandAction: (params: unknown) =>
    mockUpdateTemplateCommandAction(params),
}));

// toast モック - vi.hoisted使用
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

// crypto.randomUUID モック
vi.stubGlobal("crypto", {
  randomUUID: () => "mocked-uuid",
});

import { useTemplateEditForm } from "./useTemplateEditForm";

describe("useTemplateEditForm", () => {
  const mockTemplate = {
    id: "template-1",
    name: "テストテンプレート",
    fields: [
      { id: "field-1", label: "項目1", isRequired: true, order: 1 },
      { id: "field-2", label: "項目2", isRequired: false, order: 2 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseTemplateQuery.mockReturnValue({
      data: mockTemplate,
      isLoading: false,
    });
    mockUpdateTemplateCommandAction.mockResolvedValue({ ...mockTemplate });
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] テンプレートデータで初期化される", async () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("name")).toBe(
          "テストテンプレート",
        );
      });

      expect(result.current.fields).toHaveLength(2);
    });

    it("[Success] ローディング状態を返す", () => {
      mockUseTemplateQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] isSubmittingは初期状態でfalse", () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleAddField
  // ---------------------------------------------------------------------------
  describe("handleAddField", () => {
    it("[Success] フィールドを追加できる", async () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.fields).toHaveLength(2);
      });

      act(() => {
        result.current.handleAddField();
      });

      expect(result.current.fields).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe("remove", () => {
    it("[Success] フィールドを削除できる", async () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.fields).toHaveLength(2);
      });

      act(() => {
        result.current.remove(0);
      });

      expect(result.current.fields).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // handleDragEnd
  // ---------------------------------------------------------------------------
  describe("handleDragEnd", () => {
    it("[Success] destinationがない場合は何もしない", async () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.fields).toHaveLength(2);
      });

      const initialLength = result.current.fields.length;

      act(() => {
        result.current.handleDragEnd({
          source: { index: 0, droppableId: "fields" },
          destination: null,
          draggableId: "field-0",
          type: "DEFAULT",
          mode: "FLUID",
          reason: "CANCEL",
          combine: null,
        });
      });

      expect(result.current.fields).toHaveLength(initialLength);
    });
  });

  // ---------------------------------------------------------------------------
  // handleCancel
  // ---------------------------------------------------------------------------
  describe("handleCancel", () => {
    it("[Success] /templates/{templateId}に遷移する", () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      act(() => {
        result.current.handleCancel();
      });

      expect(mockPush).toHaveBeenCalledWith("/templates/template-1");
    });
  });

  // ---------------------------------------------------------------------------
  // handleSubmit
  // ---------------------------------------------------------------------------
  describe("handleSubmit", () => {
    it("[Success] テンプレート更新成功時にトーストと遷移", async () => {
      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("name")).toBe(
          "テストテンプレート",
        );
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockUpdateTemplateCommandAction).toHaveBeenCalledWith({
        id: "template-1",
        name: "テストテンプレート",
        fields: [
          { label: "項目1", isRequired: true, order: 1 },
          { label: "項目2", isRequired: false, order: 2 },
        ],
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "テンプレートを更新しました",
      );
      expect(mockPush).toHaveBeenCalledWith("/templates/template-1");
    });

    it("[Fail] 更新失敗時にエラートースト", async () => {
      mockUpdateTemplateCommandAction.mockRejectedValue(
        new Error("更新エラー"),
      );

      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("name")).toBe(
          "テストテンプレート",
        );
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockToastError).toHaveBeenCalledWith("更新エラー");
    });

    it("[Fail] ノートで使用中エラーの場合、長めのトースト表示", async () => {
      mockUpdateTemplateCommandAction.mockRejectedValue(
        new Error("このテンプレートはノートで使用されています"),
      );

      const { result } = renderHook(() => useTemplateEditForm("template-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("name")).toBe(
          "テストテンプレート",
        );
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "このテンプレートはノートで使用されています",
        { duration: 5000 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // useTemplateQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useTemplateQuery呼び出し", () => {
    it("[Success] templateIdで呼び出される", () => {
      renderHook(() => useTemplateEditForm("template-123"));

      expect(mockUseTemplateQuery).toHaveBeenCalledWith("template-123");
    });
  });
});
