import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted を使用
const { mockListTemplatesQueryAction, mockGetTemplateByIdQueryAction } =
  vi.hoisted(() => ({
    mockListTemplatesQueryAction: vi.fn(),
    mockGetTemplateByIdQueryAction: vi.fn(),
  }));

vi.mock("@/external/handler/template/template.query.action", () => ({
  listTemplatesQueryAction: (filters: unknown) =>
    mockListTemplatesQueryAction(filters),
  getTemplateByIdQueryAction: (params: unknown) =>
    mockGetTemplateByIdQueryAction(params),
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

import { useTemplateListQuery, useTemplateQuery } from "./useTemplateQuery";

describe("useTemplateListQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTemplatesQueryAction.mockResolvedValue([]);
  });

  it("[Success] フィルタを渡してクエリを実行する", async () => {
    const filters = { q: "検索", page: 1 };
    mockListTemplatesQueryAction.mockResolvedValue([
      { id: "1", name: "テンプレート1" },
    ]);

    const { result } = renderHook(() => useTemplateListQuery(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockListTemplatesQueryAction).toHaveBeenCalledWith(filters);
    expect(result.current.data).toEqual([{ id: "1", name: "テンプレート1" }]);
  });

  it("[Success] ローディング状態を返す", () => {
    mockListTemplatesQueryAction.mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useTemplateListQuery({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("[Fail] エラー状態を返す", async () => {
    mockListTemplatesQueryAction.mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useTemplateListQuery({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useTemplateQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTemplateByIdQueryAction.mockResolvedValue(null);
  });

  it("[Success] templateIdを渡してクエリを実行する", async () => {
    const mockTemplate = {
      id: "template-1",
      name: "テストテンプレート",
      fields: [],
    };
    mockGetTemplateByIdQueryAction.mockResolvedValue(mockTemplate);

    const { result } = renderHook(() => useTemplateQuery("template-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetTemplateByIdQueryAction).toHaveBeenCalledWith({
      id: "template-1",
    });
    expect(result.current.data).toEqual(mockTemplate);
  });

  it("[Success] ローディング状態を返す", () => {
    mockGetTemplateByIdQueryAction.mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useTemplateQuery("template-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("[Fail] エラー状態を返す", async () => {
    mockGetTemplateByIdQueryAction.mockRejectedValue(new Error("Not Found"));

    const { result } = renderHook(() => useTemplateQuery("template-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
