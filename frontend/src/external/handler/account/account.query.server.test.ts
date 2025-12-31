import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// 認証モック
vi.mock("@/features/auth/servers/auth.server", () => ({
  getSessionServer: vi.fn(),
}));

// サービスモック
vi.mock("../../service/account/account.service", () => ({
  accountService: {
    getAccountById: vi.fn(),
    getCurrentAccountByEmail: vi.fn(),
  },
}));

import { getSessionServer } from "@/features/auth/servers/auth.server";
import { accountService } from "../../service/account/account.service";
import {
  getAccountByEmailQuery,
  getAccountByIdQuery,
  getCurrentAccountQuery,
} from "./account.query.server";

// =============================================================================
// テストデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
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

const mockSession = {
  account: {
    id: VALID_UUID,
  },
};

// =============================================================================
// getCurrentAccountQuery
// =============================================================================
describe("getCurrentAccountQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] セッションがある場合、アカウントを返す", async () => {
    vi.mocked(getSessionServer).mockResolvedValue(mockSession);
    vi.mocked(accountService.getAccountById).mockResolvedValue(
      mockAccountResponse,
    );

    const result = await getCurrentAccountQuery();

    expect(result).toEqual(mockAccountResponse);
    expect(accountService.getAccountById).toHaveBeenCalledWith(VALID_UUID);
  });

  it("[Success] セッションがない場合、nullを返す", async () => {
    vi.mocked(getSessionServer).mockResolvedValue(null);

    const result = await getCurrentAccountQuery();

    expect(result).toBeNull();
    expect(accountService.getAccountById).not.toHaveBeenCalled();
  });

  it("[Success] セッションにaccountがない場合、nullを返す", async () => {
    vi.mocked(getSessionServer).mockResolvedValue({ account: null });

    const result = await getCurrentAccountQuery();

    expect(result).toBeNull();
  });

  it("[Success] アカウントが見つからない場合、nullを返す", async () => {
    vi.mocked(getSessionServer).mockResolvedValue(mockSession);
    vi.mocked(accountService.getAccountById).mockResolvedValue(null);

    const result = await getCurrentAccountQuery();

    expect(result).toBeNull();
  });
});

// =============================================================================
// getAccountByIdQuery
// =============================================================================
describe("getAccountByIdQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] アカウントを取得できる", async () => {
    vi.mocked(accountService.getAccountById).mockResolvedValue(
      mockAccountResponse,
    );

    const result = await getAccountByIdQuery({ id: VALID_UUID });

    expect(result).toEqual(mockAccountResponse);
    expect(accountService.getAccountById).toHaveBeenCalledWith(VALID_UUID);
  });

  it("[Success] アカウントが見つからない場合、nullを返す", async () => {
    vi.mocked(accountService.getAccountById).mockResolvedValue(null);

    const result = await getAccountByIdQuery({ id: VALID_UUID });

    expect(result).toBeNull();
  });

  it("[Fail] 不正なUUIDでエラーになる", async () => {
    await expect(getAccountByIdQuery({ id: "invalid-uuid" })).rejects.toThrow();
  });
});

// =============================================================================
// getAccountByEmailQuery
// =============================================================================
describe("getAccountByEmailQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] アカウントを取得できる", async () => {
    vi.mocked(accountService.getCurrentAccountByEmail).mockResolvedValue(
      mockAccountResponse,
    );

    const result = await getAccountByEmailQuery({ email: VALID_EMAIL });

    expect(result).toEqual(mockAccountResponse);
    expect(accountService.getCurrentAccountByEmail).toHaveBeenCalledWith(
      VALID_EMAIL,
    );
  });

  it("[Success] アカウントが見つからない場合、nullを返す", async () => {
    vi.mocked(accountService.getCurrentAccountByEmail).mockResolvedValue(null);

    const result = await getAccountByEmailQuery({ email: VALID_EMAIL });

    expect(result).toBeNull();
  });

  it("[Fail] 不正なメールアドレスでエラーになる", async () => {
    await expect(
      getAccountByEmailQuery({ email: "invalid-email" }),
    ).rejects.toThrow();
  });
});
