import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted を使用
const { mockListMyNoteQueryAction } = vi.hoisted(() => ({
  mockListMyNoteQueryAction: vi.fn(),
}));

vi.mock("@/external/handler/note/note.query.action", () => ({
  listMyNoteQueryAction: (filters: unknown) =>
    mockListMyNoteQueryAction(filters),
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

import { useMyNoteListQuery } from "./useMyNoteListQuery";

describe("useMyNoteListQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMyNoteQueryAction.mockResolvedValue([]);
  });

  it("[Success] フィルタを渡してクエリを実行する", async () => {
    const filters = { ownerId: "user-1", page: 1 };
    mockListMyNoteQueryAction.mockResolvedValue([
      { id: "1", title: "マイノート1" },
    ]);

    const { result } = renderHook(() => useMyNoteListQuery(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListMyNoteQueryAction).toHaveBeenCalledWith(filters);
    expect(result.current.data).toEqual([{ id: "1", title: "マイノート1" }]);
  });

  it("[Success] ローディング状態を返す", () => {
    mockListMyNoteQueryAction.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useMyNoteListQuery({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("[Fail] エラー状態を返す", async () => {
    mockListMyNoteQueryAction.mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useMyNoteListQuery({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
