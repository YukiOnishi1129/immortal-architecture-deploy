import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// React Query モック
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// useNoteDetailQuery モック
const mockUseNoteDetailQuery = vi.fn();
vi.mock("@/features/note/hooks/useNoteDetailQuery", () => ({
  useNoteDetailQuery: (noteId: string) => mockUseNoteDetailQuery(noteId),
}));

// Server Action モック
const mockUpdateNoteCommandAction = vi.fn();
vi.mock("@/external/handler/note/note.command.action", () => ({
  updateNoteCommandAction: (params: unknown) =>
    mockUpdateNoteCommandAction(params),
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

import { useNoteEditForm } from "./useNoteEditForm";

describe("useNoteEditForm", () => {
  const mockNote = {
    id: "note-1",
    title: "テストノート",
    sections: [
      {
        id: "section-1",
        fieldId: "field-1",
        fieldLabel: "項目1",
        content: "既存の内容",
        isRequired: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseNoteDetailQuery.mockReturnValue({
      data: mockNote,
      isLoading: false,
    });
    mockUpdateNoteCommandAction.mockResolvedValue({
      ...mockNote,
      title: "更新後",
    });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] ノートデータで初期化される", async () => {
      const { result } = renderHook(() => useNoteEditForm("note-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("title")).toBe("テストノート");
      });
    });

    it("[Success] ローディング状態を返す", () => {
      mockUseNoteDetailQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useNoteEditForm("note-1"));

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] isSubmittingは初期状態でfalse", () => {
      const { result } = renderHook(() => useNoteEditForm("note-1"));

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleSectionContentChange
  // ---------------------------------------------------------------------------
  describe("handleSectionContentChange", () => {
    it("[Success] セクションの内容を更新できる", async () => {
      const { result } = renderHook(() => useNoteEditForm("note-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("sections")).toHaveLength(1);
      });

      act(() => {
        result.current.handleSectionContentChange(0, "更新された内容");
      });

      expect(result.current.form.getValues("sections.0.content")).toBe(
        "更新された内容",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleCancel
  // ---------------------------------------------------------------------------
  describe("handleCancel", () => {
    it("[Success] backToがない場合/notes/{noteId}に遷移", () => {
      const { result } = renderHook(() => useNoteEditForm("note-1"));

      act(() => {
        result.current.handleCancel();
      });

      expect(mockPush).toHaveBeenCalledWith("/notes/note-1");
    });

    it("[Success] backToがある場合/my-notes/{noteId}に遷移", () => {
      const { result } = renderHook(() =>
        useNoteEditForm("note-1", { backTo: "/my-notes" }),
      );

      act(() => {
        result.current.handleCancel();
      });

      expect(mockPush).toHaveBeenCalledWith("/my-notes/note-1");
    });
  });

  // ---------------------------------------------------------------------------
  // handleSubmit
  // ---------------------------------------------------------------------------
  describe("handleSubmit", () => {
    it("[Fail] 必須項目が空の場合エラートースト", async () => {
      const { result } = renderHook(() => useNoteEditForm("note-1"));

      await waitFor(() => {
        expect(result.current.form.getValues("sections")).toHaveLength(1);
      });

      // 必須項目を空にする
      act(() => {
        result.current.handleSectionContentChange(0, "");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockToastError).toHaveBeenCalledWith("必須項目を入力してください");
      expect(mockUpdateNoteCommandAction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // useNoteDetailQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useNoteDetailQuery呼び出し", () => {
    it("[Success] noteIdで呼び出される", () => {
      renderHook(() => useNoteEditForm("note-123"));

      expect(mockUseNoteDetailQuery).toHaveBeenCalledWith("note-123");
    });
  });
});
