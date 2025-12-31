import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// サービスモック
vi.mock("../../service/account/account.service", () => ({
  accountService: {
    createOrGet: vi.fn(),
    update: vi.fn(),
  },
}));

import { accountService } from "../../service/account/account.service";
import {
  createOrGetAccountCommand,
  updateAccountCommand,
} from "./account.command.server";

// =============================================================================
// テストデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_UUID = "223e4567-e89b-12d3-a456-426614174001";
const VALID_EMAIL = "test@example.com";

const mockAccountResponse = {
  id: VALID_UUID,
  email: VALID_EMAIL,
  firstName: "太郎",
  lastName: "山田",
  fullName: "山田 太郎",
  thumbnail: null,
  lastLoginAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// =============================================================================
// createOrGetAccountCommand
// =============================================================================
describe("createOrGetAccountCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] アカウントを作成または取得できる", async () => {
    vi.mocked(accountService.createOrGet).mockResolvedValue(
      mockAccountResponse,
    );

    const result = await createOrGetAccountCommand({
      email: VALID_EMAIL,
      name: "山田 太郎",
      provider: "google",
      providerAccountId: "google-123",
    });

    expect(result).toEqual(mockAccountResponse);
    expect(accountService.createOrGet).toHaveBeenCalledWith({
      email: VALID_EMAIL,
      name: "山田 太郎",
      provider: "google",
      providerAccountId: "google-123",
    });
  });

  it("[Fail] emailが不正でエラーになる", async () => {
    await expect(
      createOrGetAccountCommand({
        email: "invalid-email",
        name: "山田 太郎",
        provider: "google",
        providerAccountId: "google-123",
      }),
    ).rejects.toThrow();
  });
});

// =============================================================================
// updateAccountCommand
// =============================================================================
describe("updateAccountCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] 自分のアカウントを更新できる", async () => {
    vi.mocked(accountService.update).mockResolvedValue(mockAccountResponse);

    const result = await updateAccountCommand(
      {
        id: VALID_UUID,
        firstName: "次郎",
      },
      VALID_UUID,
    );

    expect(result).toEqual(mockAccountResponse);
    expect(accountService.update).toHaveBeenCalledWith(VALID_UUID, {
      firstName: "次郎",
    });
  });

  it("[Fail] 他人のアカウントを更新しようとするとエラーになる", async () => {
    await expect(
      updateAccountCommand(
        {
          id: OTHER_UUID,
          firstName: "次郎",
        },
        VALID_UUID,
      ),
    ).rejects.toThrow("Forbidden: Can only update your own account");
  });

  it("[Fail] idが不正なUUIDでエラーになる", async () => {
    await expect(
      updateAccountCommand(
        {
          id: "invalid-uuid",
          firstName: "次郎",
        },
        VALID_UUID,
      ),
    ).rejects.toThrow();
  });
});
