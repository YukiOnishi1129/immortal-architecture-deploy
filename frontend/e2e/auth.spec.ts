import { expect, test } from "@playwright/test";

test.describe("認証フロー", () => {
  test.describe("ログインページ", () => {
    test("ログインページが正しく表示される", async ({ page }) => {
      await page.goto("/login");

      // タイトルが表示される
      await expect(page.getByText("Mini Notion")).toBeVisible();

      // 説明文が表示される
      await expect(
        page.getByText("設計メモを構造化して残すミニノートアプリ"),
      ).toBeVisible();

      // Googleログインボタンが表示される
      await expect(
        page.getByRole("button", { name: /Googleでログイン/i }),
      ).toBeVisible();
    });

    test("Googleログインボタンがクリック可能", async ({ page }) => {
      await page.goto("/login");

      const loginButton = page.getByRole("button", {
        name: /Googleでログイン/i,
      });
      await expect(loginButton).toBeEnabled();
    });
  });

  test.describe("未認証アクセス", () => {
    test("未認証でnotesにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/notes");

      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/);
    });

    test("未認証でtemplatesにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/templates");

      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/);
    });

    test("未認証でmy-notesにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/my-notes");

      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("トップページ", () => {
    test("未認証でトップページにアクセスするとログインページにリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/");

      // 未認証の場合はログインページにリダイレクト
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
