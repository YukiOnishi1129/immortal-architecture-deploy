import { expect, test } from "@playwright/test";

/**
 * テンプレート機能のE2Eテスト
 *
 * 未認証状態でのアクセス制御（リダイレクト）を検証する。
 * 認証済みのCRUD操作は手動テストで確認する。
 */

test.describe("テンプレート機能", () => {
  test.describe("テンプレート一覧ページ", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/templates");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("テンプレート新規作成ページ", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/templates/new");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("テンプレート詳細ページ", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      // 有効なUUID形式を使用（存在しないIDでもリダイレクトテストには影響なし）
      await page.goto("/templates/00000000-0000-0000-0000-000000000000");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("テンプレート編集ページ", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/templates/00000000-0000-0000-0000-000000000000/edit");
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
