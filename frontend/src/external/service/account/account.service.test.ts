import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountsApi } from "@/external/client/api/generated/apis/AccountsApi";
import type { ModelsAccountResponse } from "@/external/client/api/generated/models/ModelsAccountResponse";
import { AccountService } from "./account.service";

// =============================================================================
// モックデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_EMAIL = "test@example.com";

const mockAccountResponse: ModelsAccountResponse = {
  id: VALID_UUID,
  email: VALID_EMAIL,
  firstName: "太郎",
  lastName: "山田",
  fullName: "山田 太郎",
  thumbnail: "https://example.com/avatar.jpg",
  lastLoginAt: new Date("2024-01-01T00:00:00.000Z"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

function createMockApi(): AccountsApi {
  return {
    accountsCreateOrGetAccount: vi.fn(),
    accountsGetAccountById: vi.fn(),
    accountsGetAccountByEmail: vi.fn(),
  } as unknown as AccountsApi;
}

function create404Error(): Error {
  const error = new Error("Not Found") as Error & { response: Response };
  error.response = { status: 404 } as Response;
  return error;
}

function create500Error(): Error {
  const error = new Error("Internal Server Error") as Error & {
    response: Response;
  };
  error.response = { status: 500 } as Response;
  return error;
}

// =============================================================================
// AccountService Tests
// =============================================================================
describe("AccountService", () => {
  let mockApi: AccountsApi;
  let service: AccountService;

  beforeEach(() => {
    mockApi = createMockApi();
    service = new AccountService(mockApi);
  });

  // ---------------------------------------------------------------------------
  // createOrGet
  // ---------------------------------------------------------------------------
  describe("createOrGet", () => {
    it("[Success] アカウントを作成または取得できる", async () => {
      vi.mocked(mockApi.accountsCreateOrGetAccount).mockResolvedValue(
        mockAccountResponse,
      );

      const result = await service.createOrGet({
        email: VALID_EMAIL,
        name: "山田 太郎",
        provider: "google",
        providerAccountId: "google-123",
      });

      expect(mockApi.accountsCreateOrGetAccount).toHaveBeenCalledWith({
        modelsCreateOrGetAccountRequest: {
          email: VALID_EMAIL,
          name: "山田 太郎",
          provider: "google",
          providerAccountId: "google-123",
        },
      });
      expect(result.id).toBe(VALID_UUID);
      expect(result.email).toBe(VALID_EMAIL);
    });

    it("[Success] thumbnailを含むリクエストで作成できる", async () => {
      vi.mocked(mockApi.accountsCreateOrGetAccount).mockResolvedValue(
        mockAccountResponse,
      );

      await service.createOrGet({
        email: VALID_EMAIL,
        name: "山田 太郎",
        provider: "google",
        providerAccountId: "google-123",
        thumbnail: "https://example.com/avatar.jpg",
      });

      expect(mockApi.accountsCreateOrGetAccount).toHaveBeenCalledWith({
        modelsCreateOrGetAccountRequest: {
          email: VALID_EMAIL,
          name: "山田 太郎",
          provider: "google",
          providerAccountId: "google-123",
          thumbnail: "https://example.com/avatar.jpg",
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getAccountById
  // ---------------------------------------------------------------------------
  describe("getAccountById", () => {
    it("[Success] アカウントが存在する場合、AccountResponseを返す", async () => {
      vi.mocked(mockApi.accountsGetAccountById).mockResolvedValue(
        mockAccountResponse,
      );

      const result = await service.getAccountById(VALID_UUID);

      expect(mockApi.accountsGetAccountById).toHaveBeenCalledWith({
        accountId: VALID_UUID,
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
      expect(result?.email).toBe(VALID_EMAIL);
    });

    it("[Success] 404エラーの場合、nullを返す", async () => {
      vi.mocked(mockApi.accountsGetAccountById).mockRejectedValue(
        create404Error(),
      );

      const result = await service.getAccountById(VALID_UUID);

      expect(result).toBeNull();
    });

    it("[Fail] 404以外のエラーの場合、例外をスローする", async () => {
      vi.mocked(mockApi.accountsGetAccountById).mockRejectedValue(
        create500Error(),
      );

      await expect(service.getAccountById(VALID_UUID)).rejects.toThrow(
        "Internal Server Error",
      );
    });

    it("[Success] thumbnailがundefinedの場合、nullに変換される", async () => {
      const accountWithNullThumbnail = {
        ...mockAccountResponse,
        thumbnail: undefined,
      };
      vi.mocked(mockApi.accountsGetAccountById).mockResolvedValue(
        accountWithNullThumbnail,
      );

      const result = await service.getAccountById(VALID_UUID);

      expect(result?.thumbnail).toBeNull();
    });

    it("[Success] lastLoginAtがnullでも正しく変換される", async () => {
      const accountWithNullLastLogin = {
        ...mockAccountResponse,
        lastLoginAt: null,
      };
      vi.mocked(mockApi.accountsGetAccountById).mockResolvedValue(
        accountWithNullLastLogin,
      );

      const result = await service.getAccountById(VALID_UUID);

      expect(result?.lastLoginAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getCurrentAccountByEmail
  // ---------------------------------------------------------------------------
  describe("getCurrentAccountByEmail", () => {
    it("[Success] アカウントが存在する場合、AccountResponseを返す", async () => {
      vi.mocked(mockApi.accountsGetAccountByEmail).mockResolvedValue(
        mockAccountResponse,
      );

      const result = await service.getCurrentAccountByEmail(VALID_EMAIL);

      expect(mockApi.accountsGetAccountByEmail).toHaveBeenCalledWith({
        email: VALID_EMAIL,
      });
      expect(result).not.toBeNull();
      expect(result?.email).toBe(VALID_EMAIL);
    });

    it("[Success] 404エラーの場合、nullを返す", async () => {
      vi.mocked(mockApi.accountsGetAccountByEmail).mockRejectedValue(
        create404Error(),
      );

      const result = await service.getCurrentAccountByEmail(
        "notfound@example.com",
      );

      expect(result).toBeNull();
    });

    it("[Fail] 404以外のエラーの場合、例外をスローする", async () => {
      vi.mocked(mockApi.accountsGetAccountByEmail).mockRejectedValue(
        create500Error(),
      );

      await expect(
        service.getCurrentAccountByEmail(VALID_EMAIL),
      ).rejects.toThrow("Internal Server Error");
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe("update", () => {
    it("[Fail] 未実装のためエラーをスローする", async () => {
      await expect(
        service.update(VALID_UUID, { firstName: "次郎" }),
      ).rejects.toThrow(
        "Account update API is not implemented on the backend yet.",
      );
    });
  });
});
