import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Server Action モック
const mockCreateTemplateCommandAction = vi.fn();
vi.mock("@/external/handler/template/template.command.action", () => ({
  createTemplateCommandAction: (params: unknown) =>
    mockCreateTemplateCommandAction(params),
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

import { useTemplateNewForm } from "./useTemplateNewForm";

describe("useTemplateNewForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateTemplateCommandAction.mockResolvedValue({
      id: "new-template-id",
    });
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] デフォルト値で初期化される", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      expect(result.current.form.getValues()).toEqual({
        name: "",
        fields: [],
      });
      expect(result.current.fields).toEqual([]);
      expect(result.current.isCreating).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleAddField
  // ---------------------------------------------------------------------------
  describe("handleAddField", () => {
    it("[Success] フィールドを追加できる", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.handleAddField();
      });

      expect(result.current.fields).toHaveLength(1);
      expect(result.current.fields[0]).toMatchObject({
        id: "mocked-uuid",
        label: "",
        isRequired: false,
        order: 1,
      });
    });

    it("[Success] 複数フィールドを追加できる", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.handleAddField();
      });

      act(() => {
        result.current.handleAddField();
      });

      expect(result.current.fields).toHaveLength(2);
      expect(result.current.fields[1].order).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe("remove", () => {
    it("[Success] フィールドを削除できる", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.handleAddField();
        result.current.handleAddField();
      });

      expect(result.current.fields).toHaveLength(2);

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
    it("[Success] フィールドの順序を変更できる", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.handleAddField();
        result.current.handleAddField();
      });

      // 最初のフィールドにラベルを設定
      act(() => {
        result.current.form.setValue("fields.0.label", "項目1");
        result.current.form.setValue("fields.1.label", "項目2");
      });

      act(() => {
        result.current.handleDragEnd({
          source: { index: 0, droppableId: "fields" },
          destination: { index: 1, droppableId: "fields" },
          draggableId: "field-0",
          type: "DEFAULT",
          mode: "FLUID",
          reason: "DROP",
          combine: null,
        });
      });

      expect(result.current.form.getValues("fields.0.label")).toBe("項目2");
      expect(result.current.form.getValues("fields.1.label")).toBe("項目1");
    });

    it("[Success] destinationがない場合は何もしない", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.handleAddField();
      });

      const initialFields = [...result.current.fields];

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

      expect(result.current.fields).toEqual(initialFields);
    });
  });

  // ---------------------------------------------------------------------------
  // handleCancel
  // ---------------------------------------------------------------------------
  describe("handleCancel", () => {
    it("[Success] /templatesに遷移する", () => {
      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.handleCancel();
      });

      expect(mockPush).toHaveBeenCalledWith("/templates");
    });
  });

  // ---------------------------------------------------------------------------
  // handleSubmit
  // ---------------------------------------------------------------------------
  describe("handleSubmit", () => {
    it("[Success] テンプレート作成成功時にトーストと遷移", async () => {
      const { result } = renderHook(() => useTemplateNewForm());

      // フォームに値を設定
      act(() => {
        result.current.form.setValue("name", "テストテンプレート");
        result.current.handleAddField();
        result.current.form.setValue("fields.0.label", "項目1");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockCreateTemplateCommandAction).toHaveBeenCalledWith({
        name: "テストテンプレート",
        fields: [{ label: "項目1", isRequired: false, order: 1 }],
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "テンプレートを作成しました",
      );
      expect(mockPush).toHaveBeenCalledWith("/templates");
    });

    it("[Fail] 作成失敗時にエラートースト", async () => {
      mockCreateTemplateCommandAction.mockRejectedValue(
        new Error("作成エラー"),
      );

      const { result } = renderHook(() => useTemplateNewForm());

      act(() => {
        result.current.form.setValue("name", "テストテンプレート");
        result.current.handleAddField();
        result.current.form.setValue("fields.0.label", "項目1");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "テンプレートの作成に失敗しました",
      );
    });
  });
});
