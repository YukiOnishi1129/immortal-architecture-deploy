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
const mockCreateNoteCommandAction = vi.fn();
vi.mock("@/external/handler/note/note.command.action", () => ({
  createNoteCommandAction: (params: unknown) =>
    mockCreateNoteCommandAction(params),
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

import { useNoteNewForm } from "./useNoteNewForm";

describe("useNoteNewForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseTemplateQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockCreateNoteCommandAction.mockResolvedValue({ id: "new-note-id" });
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] デフォルト値で初期化される", () => {
      const { result } = renderHook(() => useNoteNewForm());

      expect(result.current.form.getValues()).toEqual({
        title: "",
        templateId: "",
        sections: [],
      });
      expect(result.current.isCreating).toBe(false);
    });

    it("[Success] initialTemplateIdが設定される", () => {
      const { result } = renderHook(() =>
        useNoteNewForm({ initialTemplateId: "template-123" }),
      );

      expect(result.current.form.getValues("templateId")).toBe("template-123");
    });
  });

  // ---------------------------------------------------------------------------
  // テンプレート選択時のセクション初期化
  // ---------------------------------------------------------------------------
  describe("テンプレート選択", () => {
    it("[Success] テンプレート選択時にセクションが初期化される", async () => {
      const mockTemplate = {
        id: "template-1",
        name: "テストテンプレート",
        fields: [
          { id: "field-1", label: "項目1", isRequired: true },
          { id: "field-2", label: "項目2", isRequired: false },
        ],
      };
      mockUseTemplateQuery.mockReturnValue({
        data: mockTemplate,
        isLoading: false,
      });

      const { result } = renderHook(() =>
        useNoteNewForm({ initialTemplateId: "template-1" }),
      );

      await waitFor(() => {
        expect(result.current.form.getValues("sections")).toEqual([
          {
            fieldId: "field-1",
            fieldLabel: "項目1",
            content: "",
            isRequired: true,
          },
          {
            fieldId: "field-2",
            fieldLabel: "項目2",
            content: "",
            isRequired: false,
          },
        ]);
      });
    });

    it("[Success] テンプレートIDが空の場合セクションがクリアされる", async () => {
      const { result } = renderHook(() => useNoteNewForm());

      await waitFor(() => {
        expect(result.current.form.getValues("sections")).toEqual([]);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // handleSectionContentChange
  // ---------------------------------------------------------------------------
  describe("handleSectionContentChange", () => {
    it("[Success] セクションの内容を更新できる", async () => {
      const mockTemplate = {
        id: "template-1",
        fields: [{ id: "field-1", label: "項目1", isRequired: false }],
      };
      mockUseTemplateQuery.mockReturnValue({
        data: mockTemplate,
        isLoading: false,
      });

      const { result } = renderHook(() =>
        useNoteNewForm({ initialTemplateId: "template-1" }),
      );

      await waitFor(() => {
        expect(result.current.form.getValues("sections")).toHaveLength(1);
      });

      act(() => {
        result.current.handleSectionContentChange(0, "新しい内容");
      });

      expect(result.current.form.getValues("sections.0.content")).toBe(
        "新しい内容",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleCancel
  // ---------------------------------------------------------------------------
  describe("handleCancel", () => {
    it("[Success] backToが指定されていない場合/my-notesに遷移", () => {
      const { result } = renderHook(() => useNoteNewForm());

      act(() => {
        result.current.handleCancel();
      });

      expect(mockPush).toHaveBeenCalledWith("/my-notes");
    });

    it("[Success] backToが指定されている場合そのパスに遷移", () => {
      const { result } = renderHook(() => useNoteNewForm({ backTo: "/notes" }));

      act(() => {
        result.current.handleCancel();
      });

      expect(mockPush).toHaveBeenCalledWith("/notes");
    });
  });

  // ---------------------------------------------------------------------------
  // selectedTemplate
  // ---------------------------------------------------------------------------
  describe("selectedTemplate", () => {
    it("[Success] テンプレートデータを返す", () => {
      const mockTemplate = {
        id: "template-1",
        name: "テストテンプレート",
        fields: [],
      };
      mockUseTemplateQuery.mockReturnValue({
        data: mockTemplate,
        isLoading: false,
      });

      const { result } = renderHook(() =>
        useNoteNewForm({ initialTemplateId: "template-1" }),
      );

      expect(result.current.selectedTemplate).toEqual(mockTemplate);
    });

    it("[Success] ローディング状態を返す", () => {
      mockUseTemplateQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() =>
        useNoteNewForm({ initialTemplateId: "template-1" }),
      );

      expect(result.current.isLoadingTemplate).toBe(true);
    });
  });
});
