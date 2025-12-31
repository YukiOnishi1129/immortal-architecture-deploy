import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted を使用
const { mockListNoteQueryAction } = vi.hoisted(() => ({
  mockListNoteQueryAction: vi.fn(),
}));

vi.mock("@/external/handler/note/note.query.action", () => ({
  listNoteQueryAction: (filters: unknown) => mockListNoteQueryAction(filters),
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

import { useNoteListQuery } from "./useNoteListQuery";

describe("useNoteListQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListNoteQueryAction.mockResolvedValue([]);
  });

  it("[Success] フィルタを渡してクエリを実行する", async () => {
    const filters = { status: "Publish" as const, page: 1 };
    mockListNoteQueryAction.mockResolvedValue([{ id: "1", title: "ノート1" }]);

    const { result } = renderHook(() => useNoteListQuery(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListNoteQueryAction).toHaveBeenCalledWith(filters);
    expect(result.current.data).toEqual([{ id: "1", title: "ノート1" }]);
  });

  it("[Success] ローディング状態を返す", () => {
    mockListNoteQueryAction.mockImplementation(
      () => new Promise(() => {}), // 永遠にpending
    );

    const { result } = renderHook(() => useNoteListQuery({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("[Fail] エラー状態を返す", async () => {
    mockListNoteQueryAction.mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useNoteListQuery({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
