import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/navigation モック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// React Query モック
const mockInvalidateQueries = vi.fn();
const mockSetQueryData = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: mockSetQueryData,
  }),
  useMutation: ({
    mutationFn,
    onSuccess,
    onError,
  }: {
    mutationFn: () => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
    onError?: () => void;
  }) => {
    const mutate = vi.fn(async () => {
      try {
        const result = await mutationFn();
        onSuccess?.(result);
      } catch {
        onError?.();
      }
    });
    return {
      mutate,
      isPending: false,
    };
  },
}));

// useNoteDetailQuery モック
const mockUseNoteDetailQuery = vi.fn();
vi.mock("@/features/note/hooks/useNoteDetailQuery", () => ({
  useNoteDetailQuery: (noteId: string) => mockUseNoteDetailQuery(noteId),
}));

// Server Action モック
vi.mock("@/external/handler/note/note.command.action", () => ({
  deleteNoteCommandAction: vi.fn(),
  publishNoteCommandAction: vi.fn(),
  unpublishNoteCommandAction: vi.fn(),
}));

// toast モック
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useNoteDetail } from "./useNoteDetail";

describe("useNoteDetail", () => {
  const mockNote = {
    id: "note-1",
    title: "テストノート",
    status: "Draft",
    sections: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNoteDetailQuery.mockReturnValue({
      data: mockNote,
      isLoading: false,
    });
  });

  // ---------------------------------------------------------------------------
  // 初期状態
  // ---------------------------------------------------------------------------
  describe("初期状態", () => {
    it("[Success] ノートデータを返す", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      expect(result.current.note).toEqual(mockNote);
    });

    it("[Success] ローディング状態を返す", () => {
      mockUseNoteDetailQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useNoteDetail("note-1"));

      expect(result.current.isLoading).toBe(true);
    });

    it("[Success] ダイアログは初期状態で閉じている", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      expect(result.current.showDeleteDialog).toBe(false);
      expect(result.current.showPublishDialog).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleEdit
  // ---------------------------------------------------------------------------
  describe("handleEdit", () => {
    it("[Success] backToがない場合/notes/{noteId}/editに遷移する", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleEdit();
      });

      expect(mockPush).toHaveBeenCalledWith("/notes/note-1/edit");
    });

    it("[Success] backToがある場合/my-notes/{noteId}/editに遷移する", () => {
      const { result } = renderHook(() =>
        useNoteDetail("note-1", { backTo: "/my-notes" }),
      );

      act(() => {
        result.current.handleEdit();
      });

      expect(mockPush).toHaveBeenCalledWith("/my-notes/note-1/edit");
    });
  });

  // ---------------------------------------------------------------------------
  // handleDelete / handleConfirmDelete / handleCancelDelete
  // ---------------------------------------------------------------------------
  describe("削除ダイアログ", () => {
    it("[Success] handleDeleteでダイアログを開く", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleDelete();
      });

      expect(result.current.showDeleteDialog).toBe(true);
    });

    it("[Success] handleCancelDeleteでダイアログを閉じる", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleDelete();
      });

      act(() => {
        result.current.handleCancelDelete();
      });

      expect(result.current.showDeleteDialog).toBe(false);
    });

    it("[Success] handleConfirmDeleteで削除を実行しダイアログを閉じる", async () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleDelete();
      });

      await act(async () => {
        result.current.handleConfirmDelete();
      });

      expect(result.current.showDeleteDialog).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleTogglePublish
  // ---------------------------------------------------------------------------
  describe("handleTogglePublish", () => {
    it("[Success] ステータスがPublishの場合、直接非公開にする", async () => {
      mockUseNoteDetailQuery.mockReturnValue({
        data: { ...mockNote, status: "Publish" },
        isLoading: false,
      });

      const { result } = renderHook(() => useNoteDetail("note-1"));

      await act(async () => {
        result.current.handleTogglePublish();
      });

      // ダイアログは開かない
      expect(result.current.showPublishDialog).toBe(false);
    });

    it("[Success] ステータスがDraftの場合、公開確認ダイアログを開く", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleTogglePublish();
      });

      expect(result.current.showPublishDialog).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // handleConfirmPublish / handleCancelPublish
  // ---------------------------------------------------------------------------
  describe("公開ダイアログ", () => {
    it("[Success] handleCancelPublishでダイアログを閉じる", () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleTogglePublish();
      });

      act(() => {
        result.current.handleCancelPublish();
      });

      expect(result.current.showPublishDialog).toBe(false);
    });

    it("[Success] handleConfirmPublishで公開を実行しダイアログを閉じる", async () => {
      const { result } = renderHook(() => useNoteDetail("note-1"));

      act(() => {
        result.current.handleTogglePublish();
      });

      await act(async () => {
        result.current.handleConfirmPublish();
      });

      expect(result.current.showPublishDialog).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // useNoteDetailQuery呼び出し
  // ---------------------------------------------------------------------------
  describe("useNoteDetailQuery呼び出し", () => {
    it("[Success] noteIdで呼び出される", () => {
      renderHook(() => useNoteDetail("note-123"));

      expect(mockUseNoteDetailQuery).toHaveBeenCalledWith("note-123");
    });
  });
});
