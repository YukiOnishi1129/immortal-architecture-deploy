import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQueryClient } from "./query-client";

describe("getQueryClient", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // クライアントサイド
  // ---------------------------------------------------------------------------
  describe("ブラウザ環境", () => {
    it("[Success] QueryClientインスタンスを返す", () => {
      const client = getQueryClient();

      expect(client).toBeInstanceOf(QueryClient);
    });

    it("[Success] 同じインスタンスを返す（シングルトン）", () => {
      const client1 = getQueryClient();
      const client2 = getQueryClient();

      expect(client1).toBe(client2);
    });

    it("[Success] デフォルトオプションが設定されている", () => {
      const client = getQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.staleTime).toBe(0);
      expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000);
      expect(defaultOptions.queries?.retry).toBe(1);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // サーバーサイド
  // ---------------------------------------------------------------------------
  describe("サーバー環境", () => {
    it("[Success] 毎回新しいインスタンスを返す", async () => {
      // windowをundefinedに設定してサーバー環境をシミュレート
      // @ts-expect-error - テスト用にwindowをundefinedに設定
      delete globalThis.window;

      // モジュールを再読み込み
      vi.resetModules();
      const { getQueryClient: getQueryClientServer } = await import(
        "./query-client"
      );

      const client1 = getQueryClientServer();
      const client2 = getQueryClientServer();

      expect(client1).not.toBe(client2);
      expect(client1).toBeInstanceOf(QueryClient);
      expect(client2).toBeInstanceOf(QueryClient);
    });
  });
});
