import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplatesApi } from "@/external/client/api/generated/apis/TemplatesApi";
import type { ModelsTemplateResponse } from "@/external/client/api/generated/models/ModelsTemplateResponse";
import { TemplateService } from "./template.service";

// =============================================================================
// モックデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const OWNER_UUID = "223e4567-e89b-12d3-a456-426614174001";
const FIELD_UUID = "323e4567-e89b-12d3-a456-426614174002";

const mockTemplateResponse: ModelsTemplateResponse = {
  id: VALID_UUID,
  name: "テストテンプレート",
  ownerId: OWNER_UUID,
  owner: {
    id: OWNER_UUID,
    firstName: "太郎",
    lastName: "山田",
    thumbnail: "https://example.com/avatar.jpg",
  },
  fields: [
    {
      id: FIELD_UUID,
      label: "フィールド1",
      order: 1,
      isRequired: true,
    },
  ],
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  isUsed: false,
};

function createMockApi(): TemplatesApi {
  return {
    templatesGetTemplateById: vi.fn(),
    templatesListTemplates: vi.fn(),
    templatesCreateTemplate: vi.fn(),
    templatesUpdateTemplate: vi.fn(),
    templatesDeleteTemplate: vi.fn(),
  } as unknown as TemplatesApi;
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
// TemplateService Tests
// =============================================================================
describe("TemplateService", () => {
  let mockApi: TemplatesApi;
  let service: TemplateService;

  beforeEach(() => {
    mockApi = createMockApi();
    service = new TemplateService(mockApi);
  });

  // ---------------------------------------------------------------------------
  // getTemplateById
  // ---------------------------------------------------------------------------
  describe("getTemplateById", () => {
    it("[Success] テンプレートが存在する場合、TemplateResponseを返す", async () => {
      vi.mocked(mockApi.templatesGetTemplateById).mockResolvedValue(
        mockTemplateResponse,
      );

      const result = await service.getTemplateById(VALID_UUID);

      expect(mockApi.templatesGetTemplateById).toHaveBeenCalledWith({
        templateId: VALID_UUID,
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
      expect(result?.name).toBe("テストテンプレート");
      expect(result?.fields).toHaveLength(1);
    });

    it("[Success] 404エラーの場合、nullを返す", async () => {
      vi.mocked(mockApi.templatesGetTemplateById).mockRejectedValue(
        create404Error(),
      );

      const result = await service.getTemplateById(VALID_UUID);

      expect(result).toBeNull();
    });

    it("[Fail] 404以外のエラーの場合、例外をスローする", async () => {
      vi.mocked(mockApi.templatesGetTemplateById).mockRejectedValue(
        create500Error(),
      );

      await expect(service.getTemplateById(VALID_UUID)).rejects.toThrow(
        "Internal Server Error",
      );
    });

    it("[Success] thumbnailがundefinedの場合、nullに変換される", async () => {
      const templateWithNullThumbnail = {
        ...mockTemplateResponse,
        owner: { ...mockTemplateResponse.owner, thumbnail: undefined },
      };
      vi.mocked(mockApi.templatesGetTemplateById).mockResolvedValue(
        templateWithNullThumbnail,
      );

      const result = await service.getTemplateById(VALID_UUID);

      expect(result?.owner.thumbnail).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplates
  // ---------------------------------------------------------------------------
  describe("getTemplates", () => {
    it("[Success] フィルタなしで全テンプレートを取得できる", async () => {
      vi.mocked(mockApi.templatesListTemplates).mockResolvedValue([
        mockTemplateResponse,
      ]);

      const result = await service.getTemplates();

      expect(mockApi.templatesListTemplates).toHaveBeenCalledWith({
        ownerId: undefined,
        q: undefined,
      });
      expect(result).toHaveLength(1);
    });

    it("[Success] ownerIdフィルタでテンプレートを取得できる", async () => {
      vi.mocked(mockApi.templatesListTemplates).mockResolvedValue([
        mockTemplateResponse,
      ]);

      await service.getTemplates({ ownerId: OWNER_UUID });

      expect(mockApi.templatesListTemplates).toHaveBeenCalledWith({
        ownerId: OWNER_UUID,
        q: undefined,
      });
    });

    it("[Success] qフィルタでテンプレートを検索できる", async () => {
      vi.mocked(mockApi.templatesListTemplates).mockResolvedValue([
        mockTemplateResponse,
      ]);

      await service.getTemplates({ q: "検索クエリ" });

      expect(mockApi.templatesListTemplates).toHaveBeenCalledWith({
        ownerId: undefined,
        q: "検索クエリ",
      });
    });

    it("[Success] 複数のフィルタを組み合わせて取得できる", async () => {
      vi.mocked(mockApi.templatesListTemplates).mockResolvedValue([
        mockTemplateResponse,
      ]);

      await service.getTemplates({ ownerId: OWNER_UUID, q: "検索" });

      expect(mockApi.templatesListTemplates).toHaveBeenCalledWith({
        ownerId: OWNER_UUID,
        q: "検索",
      });
    });

    it("[Success] 空の配列を返す場合も正常に動作する", async () => {
      vi.mocked(mockApi.templatesListTemplates).mockResolvedValue([]);

      const result = await service.getTemplates();

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // createTemplate
  // ---------------------------------------------------------------------------
  describe("createTemplate", () => {
    it("[Success] テンプレートを作成できる", async () => {
      vi.mocked(mockApi.templatesCreateTemplate).mockResolvedValue(
        mockTemplateResponse,
      );

      const result = await service.createTemplate(OWNER_UUID, {
        name: "新規テンプレート",
        fields: [{ label: "フィールド1", order: 1, isRequired: true }],
      });

      expect(mockApi.templatesCreateTemplate).toHaveBeenCalledWith({
        modelsCreateTemplateRequest: {
          name: "新規テンプレート",
          ownerId: OWNER_UUID,
          fields: [{ label: "フィールド1", order: 1, isRequired: true }],
        },
      });
      expect(result.id).toBe(VALID_UUID);
    });

    it("[Success] 複数フィールドを持つテンプレートを作成できる", async () => {
      vi.mocked(mockApi.templatesCreateTemplate).mockResolvedValue(
        mockTemplateResponse,
      );

      await service.createTemplate(OWNER_UUID, {
        name: "複数フィールド",
        fields: [
          { label: "フィールド1", order: 1, isRequired: true },
          { label: "フィールド2", order: 2, isRequired: false },
        ],
      });

      expect(mockApi.templatesCreateTemplate).toHaveBeenCalledWith({
        modelsCreateTemplateRequest: {
          name: "複数フィールド",
          ownerId: OWNER_UUID,
          fields: [
            { label: "フィールド1", order: 1, isRequired: true },
            { label: "フィールド2", order: 2, isRequired: false },
          ],
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateTemplate
  // ---------------------------------------------------------------------------
  describe("updateTemplate", () => {
    it("[Success] テンプレートを更新できる", async () => {
      vi.mocked(mockApi.templatesUpdateTemplate).mockResolvedValue(
        mockTemplateResponse,
      );

      const result = await service.updateTemplate(VALID_UUID, OWNER_UUID, {
        name: "更新後テンプレート",
        fields: [
          {
            id: FIELD_UUID,
            label: "更新フィールド",
            order: 1,
            isRequired: true,
          },
        ],
      });

      expect(mockApi.templatesUpdateTemplate).toHaveBeenCalledWith({
        templateId: VALID_UUID,
        ownerId: OWNER_UUID,
        modelsUpdateTemplateRequest: {
          id: VALID_UUID,
          name: "更新後テンプレート",
          fields: [
            {
              id: FIELD_UUID,
              label: "更新フィールド",
              order: 1,
              isRequired: true,
            },
          ],
        },
      });
      expect(result.id).toBe(VALID_UUID);
    });

    it("[Success] 新規フィールド追加と既存フィールド更新を同時に行える", async () => {
      vi.mocked(mockApi.templatesUpdateTemplate).mockResolvedValue(
        mockTemplateResponse,
      );

      await service.updateTemplate(VALID_UUID, OWNER_UUID, {
        name: "更新テンプレート",
        fields: [
          {
            id: FIELD_UUID,
            label: "既存フィールド",
            order: 1,
            isRequired: true,
          },
          { label: "新規フィールド", order: 2, isRequired: false },
        ],
      });

      expect(mockApi.templatesUpdateTemplate).toHaveBeenCalledWith({
        templateId: VALID_UUID,
        ownerId: OWNER_UUID,
        modelsUpdateTemplateRequest: {
          id: VALID_UUID,
          name: "更新テンプレート",
          fields: [
            {
              id: FIELD_UUID,
              label: "既存フィールド",
              order: 1,
              isRequired: true,
            },
            {
              id: undefined,
              label: "新規フィールド",
              order: 2,
              isRequired: false,
            },
          ],
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTemplate
  // ---------------------------------------------------------------------------
  describe("deleteTemplate", () => {
    it("[Success] テンプレートを削除できる", async () => {
      vi.mocked(mockApi.templatesDeleteTemplate).mockResolvedValue({
        success: true,
      });

      await service.deleteTemplate(VALID_UUID, OWNER_UUID);

      expect(mockApi.templatesDeleteTemplate).toHaveBeenCalledWith({
        templateId: VALID_UUID,
        ownerId: OWNER_UUID,
      });
    });
  });
});
