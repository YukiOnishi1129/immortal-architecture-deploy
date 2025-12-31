import { expect, test } from "@playwright/test";

/**
 * ノート機能のE2Eテスト
 *
 * 未認証状態でのアクセス制御（リダイレクト）を検証する。
 * 認証済みのCRUD操作は手動テストで確認する。
 */

test.describe("ノート機能", () => {
  test.describe("みんなのノート一覧ページ", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/notes");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("マイノート一覧ページ", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/my-notes");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("ノート新規作成ページ（notes）", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/notes/new");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("ノート新規作成ページ（my-notes）", () => {
    test("未認証でアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/my-notes/new");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("ノート詳細ページ", () => {
    test("未認証で/notes/:idにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      // 有効なUUID形式を使用（存在しないIDでもリダイレクトテストには影響なし）
      await page.goto("/notes/00000000-0000-0000-0000-000000000000");
      await expect(page).toHaveURL(/\/login/);
    });

    test("未認証で/my-notes/:idにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/my-notes/00000000-0000-0000-0000-000000000000");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("ノート編集ページ", () => {
    test("未認証で/notes/:id/editにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/notes/00000000-0000-0000-0000-000000000000/edit");
      await expect(page).toHaveURL(/\/login/);
    });

    test("未認証で/my-notes/:id/editにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/my-notes/00000000-0000-0000-0000-000000000000/edit");
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
