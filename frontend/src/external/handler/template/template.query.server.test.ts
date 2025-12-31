import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// 認証モック
vi.mock("@/features/auth/servers/redirect.server", () => ({
  requireAuthServer: vi.fn(),
}));

vi.mock("@/features/auth/servers/auth.server", () => ({
  getSessionServer: vi.fn(),
}));

// サービスモック
vi.mock("../../service/template/template.service", () => ({
  templateService: {
    getTemplateById: vi.fn(),
    getTemplates: vi.fn(),
  },
}));

import { getSessionServer } from "@/features/auth/servers/auth.server";
import { requireAuthServer } from "@/features/auth/servers/redirect.server";
import { templateService } from "../../service/template/template.service";
import {
  getTemplateByIdQuery,
  listMyTemplatesQuery,
  listTemplatesQuery,
} from "./template.query.server";

// =============================================================================
// テストデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const OWNER_UUID = "223e4567-e89b-12d3-a456-426614174001";
const FIELD_UUID = "323e4567-e89b-12d3-a456-426614174002";

const mockTemplateResponse = {
  id: VALID_UUID,
  name: "テストテンプレート",
  ownerId: OWNER_UUID,
  owner: {
    id: OWNER_UUID,
    firstName: "太郎",
    lastName: "山田",
    thumbnail: null,
  },
  fields: [
    {
      id: FIELD_UUID,
      label: "フィールド1",
      order: 1,
      isRequired: true,
    },
  ],
  updatedAt: "2024-01-01T00:00:00.000Z",
  isUsed: false,
};

const mockSession = {
  account: {
    id: OWNER_UUID,
  },
};

// =============================================================================
// getTemplateByIdQuery
// =============================================================================
describe("getTemplateByIdQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] テンプレートを取得できる", async () => {
    vi.mocked(templateService.getTemplateById).mockResolvedValue(
      mockTemplateResponse,
    );

    const result = await getTemplateByIdQuery({ id: VALID_UUID });

    expect(result).toEqual(mockTemplateResponse);
    expect(templateService.getTemplateById).toHaveBeenCalledWith(VALID_UUID);
  });

  it("[Success] テンプレートが見つからない場合はnullを返す", async () => {
    vi.mocked(templateService.getTemplateById).mockResolvedValue(null);

    const result = await getTemplateByIdQuery({ id: VALID_UUID });

    expect(result).toBeNull();
  });

  it("[Fail] 不正なUUIDでエラーになる", async () => {
    await expect(
      getTemplateByIdQuery({ id: "invalid-uuid" }),
    ).rejects.toThrow();
  });
});

// =============================================================================
// listTemplatesQuery
// =============================================================================
describe("listTemplatesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionServer).mockResolvedValue(mockSession);
  });

  it("[Success] 認証チェックを実行する", async () => {
    vi.mocked(templateService.getTemplates).mockResolvedValue([]);

    await listTemplatesQuery();

    expect(requireAuthServer).toHaveBeenCalled();
  });

  it("[Success] フィルタなしでテンプレート一覧を取得できる", async () => {
    vi.mocked(templateService.getTemplates).mockResolvedValue([
      mockTemplateResponse,
    ]);

    const result = await listTemplatesQuery();

    expect(result).toHaveLength(1);
    expect(templateService.getTemplates).toHaveBeenCalledWith({
      ownerId: undefined,
      q: undefined,
    });
  });

  it("[Success] onlyMyTemplatesがtrueの場合、自分のテンプレートのみ取得する", async () => {
    vi.mocked(templateService.getTemplates).mockResolvedValue([
      mockTemplateResponse,
    ]);

    await listTemplatesQuery({ onlyMyTemplates: true });

    expect(templateService.getTemplates).toHaveBeenCalledWith({
      ownerId: OWNER_UUID,
      q: undefined,
    });
  });

  it("[Success] qフィルタで検索できる", async () => {
    vi.mocked(templateService.getTemplates).mockResolvedValue([
      mockTemplateResponse,
    ]);

    await listTemplatesQuery({ q: "検索クエリ" });

    expect(templateService.getTemplates).toHaveBeenCalledWith({
      ownerId: undefined,
      q: "検索クエリ",
    });
  });

  it("[Fail] セッションがない場合はエラーになる", async () => {
    vi.mocked(getSessionServer).mockResolvedValue(null);

    await expect(listTemplatesQuery()).rejects.toThrow(
      "Unauthorized: No active session",
    );
  });
});

// =============================================================================
// listMyTemplatesQuery
// =============================================================================
describe("listMyTemplatesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] 指定されたaccountIdでテンプレートを取得する", async () => {
    vi.mocked(templateService.getTemplates).mockResolvedValue([
      mockTemplateResponse,
    ]);

    const result = await listMyTemplatesQuery(OWNER_UUID);

    expect(result).toHaveLength(1);
    expect(templateService.getTemplates).toHaveBeenCalledWith({
      ownerId: OWNER_UUID,
    });
  });

  it("[Success] 空の配列を返す場合も正常に動作する", async () => {
    vi.mocked(templateService.getTemplates).mockResolvedValue([]);

    const result = await listMyTemplatesQuery(OWNER_UUID);

    expect(result).toHaveLength(0);
  });
});
