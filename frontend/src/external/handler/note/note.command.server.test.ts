import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// サービスモック
vi.mock("../../service/note/note.service", () => ({
  noteService: {
    createNote: vi.fn(),
    updateNote: vi.fn(),
    publishNote: vi.fn(),
    unpublishNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

import { noteService } from "../../service/note/note.service";
import {
  createNoteCommand,
  deleteNoteCommand,
  publishNoteCommand,
  unpublishNoteCommand,
  updateNoteCommand,
} from "./note.command.server";

// =============================================================================
// テストデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const OWNER_UUID = "223e4567-e89b-12d3-a456-426614174001";
const TEMPLATE_UUID = "323e4567-e89b-12d3-a456-426614174002";
const FIELD_UUID = "423e4567-e89b-12d3-a456-426614174003";
const SECTION_UUID = "523e4567-e89b-12d3-a456-426614174004";

const mockNoteResponse = {
  id: VALID_UUID,
  title: "テストノート",
  templateId: TEMPLATE_UUID,
  templateName: "テストテンプレート",
  ownerId: OWNER_UUID,
  owner: {
    id: OWNER_UUID,
    firstName: "太郎",
    lastName: "山田",
    thumbnail: null,
  },
  status: "Draft" as const,
  sections: [
    {
      id: SECTION_UUID,
      fieldId: FIELD_UUID,
      fieldLabel: "フィールド1",
      content: "セクション内容",
      isRequired: true,
    },
  ],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// =============================================================================
// createNoteCommand
// =============================================================================
describe("createNoteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] ノートを作成できる", async () => {
    vi.mocked(noteService.createNote).mockResolvedValue(mockNoteResponse);

    const result = await createNoteCommand(
      {
        title: "新規ノート",
        templateId: TEMPLATE_UUID,
        sections: [{ fieldId: FIELD_UUID, content: "内容" }],
      },
      OWNER_UUID,
    );

    expect(result.id).toBe(VALID_UUID);
    expect(noteService.createNote).toHaveBeenCalledWith(OWNER_UUID, {
      title: "新規ノート",
      templateId: TEMPLATE_UUID,
      sections: [{ fieldId: FIELD_UUID, content: "内容" }],
    });
  });

  it("[Fail] titleが空文字でエラーになる", async () => {
    await expect(
      createNoteCommand(
        {
          title: "",
          templateId: TEMPLATE_UUID,
          sections: [],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });

  it("[Fail] templateIdが不正なUUIDでエラーになる", async () => {
    await expect(
      createNoteCommand(
        {
          title: "ノート",
          templateId: "invalid-uuid",
          sections: [],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });

  it("[Fail] titleが100文字を超えるとエラーになる", async () => {
    await expect(
      createNoteCommand(
        {
          title: "a".repeat(101),
          templateId: TEMPLATE_UUID,
          sections: [],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });
});

// =============================================================================
// updateNoteCommand
// =============================================================================
describe("updateNoteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] ノートを更新できる", async () => {
    vi.mocked(noteService.updateNote).mockResolvedValue(mockNoteResponse);

    const result = await updateNoteCommand(
      {
        id: VALID_UUID,
        title: "更新後タイトル",
        sections: [{ id: SECTION_UUID, content: "更新内容" }],
      },
      OWNER_UUID,
    );

    expect(result.id).toBe(VALID_UUID);
    expect(noteService.updateNote).toHaveBeenCalledWith(
      VALID_UUID,
      OWNER_UUID,
      {
        title: "更新後タイトル",
        sections: [{ id: SECTION_UUID, content: "更新内容" }],
      },
    );
  });

  it("[Fail] idが不正なUUIDでエラーになる", async () => {
    await expect(
      updateNoteCommand(
        {
          id: "invalid-uuid",
          title: "タイトル",
          sections: [],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });

  it("[Fail] titleが空文字でエラーになる", async () => {
    await expect(
      updateNoteCommand(
        {
          id: VALID_UUID,
          title: "",
          sections: [],
        },
        OWNER_UUID,
      ),
    ).rejects.toThrow();
  });
});

// =============================================================================
// publishNoteCommand
// =============================================================================
describe("publishNoteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] ノートを公開できる", async () => {
    const publishedNote = { ...mockNoteResponse, status: "Publish" as const };
    vi.mocked(noteService.publishNote).mockResolvedValue(publishedNote);

    const result = await publishNoteCommand({ noteId: VALID_UUID }, OWNER_UUID);

    expect(result.status).toBe("Publish");
    expect(noteService.publishNote).toHaveBeenCalledWith(
      VALID_UUID,
      OWNER_UUID,
    );
  });

  it("[Fail] noteIdが不正なUUIDでエラーになる", async () => {
    await expect(
      publishNoteCommand({ noteId: "invalid-uuid" }, OWNER_UUID),
    ).rejects.toThrow();
  });
});

// =============================================================================
// unpublishNoteCommand
// =============================================================================
describe("unpublishNoteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] ノートを非公開にできる", async () => {
    vi.mocked(noteService.unpublishNote).mockResolvedValue(mockNoteResponse);

    const result = await unpublishNoteCommand(
      { noteId: VALID_UUID },
      OWNER_UUID,
    );

    expect(result.status).toBe("Draft");
    expect(noteService.unpublishNote).toHaveBeenCalledWith(
      VALID_UUID,
      OWNER_UUID,
    );
  });

  it("[Fail] noteIdが不正なUUIDでエラーになる", async () => {
    await expect(
      unpublishNoteCommand({ noteId: "invalid-uuid" }, OWNER_UUID),
    ).rejects.toThrow();
  });
});

// =============================================================================
// deleteNoteCommand
// =============================================================================
describe("deleteNoteCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] ノートを削除できる", async () => {
    vi.mocked(noteService.deleteNote).mockResolvedValue(undefined);

    const result = await deleteNoteCommand({ id: VALID_UUID }, OWNER_UUID);

    expect(result).toEqual({ success: true });
    expect(noteService.deleteNote).toHaveBeenCalledWith(VALID_UUID, OWNER_UUID);
  });

  it("[Fail] idが不正なUUIDでエラーになる", async () => {
    await expect(
      deleteNoteCommand({ id: "invalid-uuid" }, OWNER_UUID),
    ).rejects.toThrow();
  });
});
