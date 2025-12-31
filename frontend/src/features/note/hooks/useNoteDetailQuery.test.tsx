import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted を使用
const { mockGetNoteByIdQueryAction } = vi.hoisted(() => ({
  mockGetNoteByIdQueryAction: vi.fn(),
}));

vi.mock("@/external/handler/note/note.query.action", () => ({
  getNoteByIdQueryAction: (params: unknown) =>
    mockGetNoteByIdQueryAction(params),
}));

// React Query wrapper
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

import { useNoteDetailQuery } from "./useNoteDetailQuery";

describe("useNoteDetailQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNoteByIdQueryAction.mockResolvedValue(null);
  });

  it("[Success] noteIdを渡してクエリを実行する", async () => {
    const mockNote = {
      id: "note-1",
      title: "テストノート",
      sections: [],
    };
    mockGetNoteByIdQueryAction.mockResolvedValue(mockNote);

    const { result } = renderHook(() => useNoteDetailQuery("note-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetNoteByIdQueryAction).toHaveBeenCalledWith({ id: "note-1" });
    expect(result.current.data).toEqual(mockNote);
  });

  it("[Success] ローディング状態を返す", () => {
    mockGetNoteByIdQueryAction.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useNoteDetailQuery("note-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("[Fail] エラー状態を返す", async () => {
    mockGetNoteByIdQueryAction.mockRejectedValue(new Error("Not Found"));

    const { result } = renderHook(() => useNoteDetailQuery("note-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
