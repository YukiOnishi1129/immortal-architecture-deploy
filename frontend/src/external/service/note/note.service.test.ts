import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotesApi } from "@/external/client/api/generated/apis/NotesApi";
import type { ModelsNoteResponse } from "@/external/client/api/generated/models/ModelsNoteResponse";
import { NoteService } from "./note.service";

// =============================================================================
// モックデータ
// =============================================================================
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const OWNER_UUID = "223e4567-e89b-12d3-a456-426614174001";
const TEMPLATE_UUID = "323e4567-e89b-12d3-a456-426614174002";
const FIELD_UUID = "423e4567-e89b-12d3-a456-426614174003";
const SECTION_UUID = "523e4567-e89b-12d3-a456-426614174004";

const mockNoteResponse: ModelsNoteResponse = {
  id: VALID_UUID,
  title: "テストノート",
  templateId: TEMPLATE_UUID,
  templateName: "テストテンプレート",
  ownerId: OWNER_UUID,
  owner: {
    id: OWNER_UUID,
    firstName: "太郎",
    lastName: "山田",
    thumbnail: "https://example.com/avatar.jpg",
  },
  status: "Draft",
  sections: [
    {
      id: SECTION_UUID,
      fieldId: FIELD_UUID,
      fieldLabel: "フィールド1",
      content: "セクション内容",
      isRequired: true,
    },
  ],
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

function createMockApi(): NotesApi {
  return {
    notesGetNoteById: vi.fn(),
    notesListNotes: vi.fn(),
    notesCreateNote: vi.fn(),
    notesUpdateNote: vi.fn(),
    notesPublishNote: vi.fn(),
    notesUnpublishNote: vi.fn(),
    notesDeleteNote: vi.fn(),
  } as unknown as NotesApi;
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
// NoteService Tests
// =============================================================================
describe("NoteService", () => {
  let mockApi: NotesApi;
  let service: NoteService;

  beforeEach(() => {
    mockApi = createMockApi();
    service = new NoteService(mockApi);
  });

  // ---------------------------------------------------------------------------
  // getNoteById
  // ---------------------------------------------------------------------------
  describe("getNoteById", () => {
    it("[Success] ノートが存在する場合、NoteResponseを返す", async () => {
      vi.mocked(mockApi.notesGetNoteById).mockResolvedValue(mockNoteResponse);

      const result = await service.getNoteById(VALID_UUID);

      expect(mockApi.notesGetNoteById).toHaveBeenCalledWith({
        noteId: VALID_UUID,
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(VALID_UUID);
      expect(result?.title).toBe("テストノート");
      expect(result?.status).toBe("Draft");
      expect(result?.sections).toHaveLength(1);
    });

    it("[Success] 404エラーの場合、nullを返す", async () => {
      vi.mocked(mockApi.notesGetNoteById).mockRejectedValue(create404Error());

      const result = await service.getNoteById(VALID_UUID);

      expect(result).toBeNull();
    });

    it("[Fail] 404以外のエラーの場合、例外をスローする", async () => {
      vi.mocked(mockApi.notesGetNoteById).mockRejectedValue(create500Error());

      await expect(service.getNoteById(VALID_UUID)).rejects.toThrow(
        "Internal Server Error",
      );
    });

    it("[Success] thumbnailがnullの場合でも正しく変換される", async () => {
      const noteWithNullThumbnail = {
        ...mockNoteResponse,
        owner: { ...mockNoteResponse.owner, thumbnail: undefined },
      };
      vi.mocked(mockApi.notesGetNoteById).mockResolvedValue(
        noteWithNullThumbnail,
      );

      const result = await service.getNoteById(VALID_UUID);

      expect(result?.owner.thumbnail).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getNotes
  // ---------------------------------------------------------------------------
  describe("getNotes", () => {
    it("[Success] フィルタなしで全ノートを取得できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      const result = await service.getNotes();

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: undefined,
        status: undefined,
        templateId: undefined,
        ownerId: undefined,
      });
      expect(result).toHaveLength(1);
    });

    it("[Success] searchフィルタでノートを検索できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      await service.getNotes({ search: "検索クエリ" });

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: "検索クエリ",
        status: undefined,
        templateId: undefined,
        ownerId: undefined,
      });
    });

    it("[Success] qフィルタでノートを検索できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      await service.getNotes({ q: "検索クエリ" });

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: "検索クエリ",
        status: undefined,
        templateId: undefined,
        ownerId: undefined,
      });
    });

    it("[Success] statusフィルタでノートを取得できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      await service.getNotes({ status: "Draft" });

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: undefined,
        status: "Draft",
        templateId: undefined,
        ownerId: undefined,
      });
    });

    it("[Success] templateIdフィルタでノートを取得できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      await service.getNotes({ templateId: TEMPLATE_UUID });

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: undefined,
        status: undefined,
        templateId: TEMPLATE_UUID,
        ownerId: undefined,
      });
    });

    it("[Success] ownerIdフィルタでノートを取得できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      await service.getNotes({ ownerId: OWNER_UUID });

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: undefined,
        status: undefined,
        templateId: undefined,
        ownerId: OWNER_UUID,
      });
    });

    it("[Success] 複数のフィルタを組み合わせて取得できる", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([mockNoteResponse]);

      await service.getNotes({
        q: "検索",
        status: "Publish",
        templateId: TEMPLATE_UUID,
        ownerId: OWNER_UUID,
      });

      expect(mockApi.notesListNotes).toHaveBeenCalledWith({
        q: "検索",
        status: "Publish",
        templateId: TEMPLATE_UUID,
        ownerId: OWNER_UUID,
      });
    });

    it("[Success] 空の配列を返す場合も正常に動作する", async () => {
      vi.mocked(mockApi.notesListNotes).mockResolvedValue([]);

      const result = await service.getNotes();

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // createNote
  // ---------------------------------------------------------------------------
  describe("createNote", () => {
    it("[Success] ノートを作成できる", async () => {
      vi.mocked(mockApi.notesCreateNote).mockResolvedValue(mockNoteResponse);

      const result = await service.createNote(OWNER_UUID, {
        title: "新規ノート",
        templateId: TEMPLATE_UUID,
        sections: [{ fieldId: FIELD_UUID, content: "内容" }],
      });

      expect(mockApi.notesCreateNote).toHaveBeenCalledWith({
        modelsCreateNoteRequest: {
          title: "新規ノート",
          templateId: TEMPLATE_UUID,
          ownerId: OWNER_UUID,
          sections: [{ fieldId: FIELD_UUID, content: "内容" }],
        },
      });
      expect(result.id).toBe(VALID_UUID);
    });

    it("[Success] sectionsがundefinedの場合、空配列で送信される", async () => {
      vi.mocked(mockApi.notesCreateNote).mockResolvedValue(mockNoteResponse);

      await service.createNote(OWNER_UUID, {
        title: "新規ノート",
        templateId: TEMPLATE_UUID,
      });

      expect(mockApi.notesCreateNote).toHaveBeenCalledWith({
        modelsCreateNoteRequest: {
          title: "新規ノート",
          templateId: TEMPLATE_UUID,
          ownerId: OWNER_UUID,
          sections: [],
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateNote
  // ---------------------------------------------------------------------------
  describe("updateNote", () => {
    it("[Success] ノートを更新できる", async () => {
      vi.mocked(mockApi.notesUpdateNote).mockResolvedValue(mockNoteResponse);

      const result = await service.updateNote(VALID_UUID, OWNER_UUID, {
        title: "更新後タイトル",
        sections: [{ id: SECTION_UUID, content: "更新後内容" }],
      });

      expect(mockApi.notesUpdateNote).toHaveBeenCalledWith({
        noteId: VALID_UUID,
        ownerId: OWNER_UUID,
        modelsUpdateNoteRequest: {
          id: VALID_UUID,
          title: "更新後タイトル",
          sections: [{ id: SECTION_UUID, content: "更新後内容" }],
        },
      });
      expect(result.id).toBe(VALID_UUID);
    });
  });

  // ---------------------------------------------------------------------------
  // publishNote
  // ---------------------------------------------------------------------------
  describe("publishNote", () => {
    it("[Success] ノートを公開できる", async () => {
      const publishedNote = { ...mockNoteResponse, status: "Publish" as const };
      vi.mocked(mockApi.notesPublishNote).mockResolvedValue(publishedNote);

      const result = await service.publishNote(VALID_UUID, OWNER_UUID);

      expect(mockApi.notesPublishNote).toHaveBeenCalledWith({
        noteId: VALID_UUID,
        ownerId: OWNER_UUID,
      });
      expect(result.status).toBe("Publish");
    });
  });

  // ---------------------------------------------------------------------------
  // unpublishNote
  // ---------------------------------------------------------------------------
  describe("unpublishNote", () => {
    it("[Success] ノートを非公開にできる", async () => {
      const unpublishedNote = {
        ...mockNoteResponse,
        status: "Draft" as const,
      };
      vi.mocked(mockApi.notesUnpublishNote).mockResolvedValue(unpublishedNote);

      const result = await service.unpublishNote(VALID_UUID, OWNER_UUID);

      expect(mockApi.notesUnpublishNote).toHaveBeenCalledWith({
        noteId: VALID_UUID,
        ownerId: OWNER_UUID,
      });
      expect(result.status).toBe("Draft");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteNote
  // ---------------------------------------------------------------------------
  describe("deleteNote", () => {
    it("[Success] ノートを削除できる", async () => {
      vi.mocked(mockApi.notesDeleteNote).mockResolvedValue({
        success: true,
      });

      await service.deleteNote(VALID_UUID, OWNER_UUID);

      expect(mockApi.notesDeleteNote).toHaveBeenCalledWith({
        noteId: VALID_UUID,
        ownerId: OWNER_UUID,
      });
    });
  });
});
