import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// サービスモック
vi.mock("../../service/template/template.service", () => ({
  templateService: {
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
  },
}));

import { templateService } from "../../service/template/template.service";
import {
  createTemplateCommand,
  deleteTemplateCommand,
  updateTemplateCommand,
} from "./template.command.server";

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

// =============================================================================
// createTemplateCommand
// =============================================================================
describe("createTemplateCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] テンプレートを作成できる", async () => {
    vi.mocked(templateService.createTemplate).mockResolvedValue(
      mockTemplateResponse,
    );

    const result = await createTemplateCommand(
      {
        name: "新規テンプレート",
        fields: [{ label: "フィールド1", order: 1, isRequired: true }],
      },
      OWNER_UUID,
    );

    expect(result.id).toBe(VALID_UUID);
    expect(templateService.createTemplate).toHaveBeenCalledWith(OWNER_UUID, {
      name: "新規テンプレート",
      fields: [{ label: "フィールド1", order: 1, isRequired: true }],
    });
  });

  it("[Fail] nameが空文字でエラーになる", async () => {
    await expect(
      createTemplateCommand(
        {
          name: "",
          fields: [{ label: "フィールド", order: 1, isRequired: true }],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });

  it("[Fail] fieldsが空配列でエラーになる", async () => {
    await expect(
      createTemplateCommand(
        {
          name: "テンプレート",
          fields: [],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });

  it("[Fail] nameが100文字を超えるとエラーになる", async () => {
    await expect(
      createTemplateCommand(
        {
          name: "a".repeat(101),
          fields: [{ label: "フィールド", order: 1, isRequired: true }],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });
});

// =============================================================================
// updateTemplateCommand
// =============================================================================
describe("updateTemplateCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] テンプレートを更新できる", async () => {
    vi.mocked(templateService.updateTemplate).mockResolvedValue(
      mockTemplateResponse,
    );

    const result = await updateTemplateCommand(
      {
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
      OWNER_UUID,
    );

    expect(result.id).toBe(VALID_UUID);
    expect(templateService.updateTemplate).toHaveBeenCalledWith(
      VALID_UUID,
      OWNER_UUID,
      {
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
    );
  });

  it("[Fail] idが不正なUUIDでエラーになる", async () => {
    await expect(
      updateTemplateCommand(
        {
          id: "invalid-uuid",
          name: "テンプレート",
          fields: [{ label: "フィールド", order: 1, isRequired: true }],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });

  it("[Fail] TEMPLATE_FIELD_IN_USEエラーを適切なメッセージに変換する", async () => {
    vi.mocked(templateService.updateTemplate).mockRejectedValue(
      new Error("TEMPLATE_FIELD_IN_USE"),
    );

    await expect(
      updateTemplateCommand(
        {
          id: VALID_UUID,
          name: "テンプレート",
          fields: [{ label: "フィールド", order: 1, isRequired: true }],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow(
      "テンプレートの項目は変更・削除できません。ノートで使用されています。",
    );
  });

  it("[Fail] TEMPLATE_STRUCTURE_LOCKEDエラーを適切なメッセージに変換する", async () => {
    vi.mocked(templateService.updateTemplate).mockRejectedValue(
      new Error("TEMPLATE_STRUCTURE_LOCKED"),
    );

    await expect(
      updateTemplateCommand(
        {
          id: VALID_UUID,
          name: "テンプレート",
          fields: [{ label: "フィールド", order: 1, isRequired: true }],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow(
      "テンプレートの項目は変更・削除できません。ノートで使用されています。",
    );
  });

  it("[Fail] その他のエラーはそのままスローされる", async () => {
    vi.mocked(templateService.updateTemplate).mockRejectedValue(
      new Error("Unknown Error"),
    );

    await expect(
      updateTemplateCommand(
        {
          id: VALID_UUID,
          name: "テンプレート",
          fields: [{ label: "フィールド", order: 1, isRequired: true }],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow("Unknown Error");
  });
});

// =============================================================================
// deleteTemplateCommand
// =============================================================================
describe("deleteTemplateCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] テンプレートを削除できる", async () => {
    vi.mocked(templateService.deleteTemplate).mockResolvedValue(undefined);

    const result = await deleteTemplateCommand({ id: VALID_UUID }, OWNER_UUID);

    expect(result).toEqual({ success: true });
    expect(templateService.deleteTemplate).toHaveBeenCalledWith(
      VALID_UUID,
      OWNER_UUID,
    );
  });

  it("[Fail] idが不正なUUIDでエラーになる", async () => {
    await expect(
      deleteTemplateCommand({ id: "invalid-uuid" }, OWNER_UUID),
    ).rejects.toThrow();
  });
});
