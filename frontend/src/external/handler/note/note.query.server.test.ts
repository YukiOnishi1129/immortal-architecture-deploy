import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only モック
vi.mock("server-only", () => ({}));

// 認証モック
vi.mock("@/features/auth/servers/redirect.server", () => ({
  requireAuthServer: vi.fn(),
}));

// サービスモック
vi.mock("../../service/note/note.service", () => ({
  noteService: {
    getNoteById: vi.fn(),
    getNotes: vi.fn(),
  },
}));

import { requireAuthServer } from "@/features/auth/servers/redirect.server";
import { noteService } from "../../service/note/note.service";
import {
  getNoteByIdQuery,
  listMyNoteQuery,
  listNoteQuery,
} from "./note.query.server";

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
// getNoteByIdQuery
// =============================================================================
describe("getNoteByIdQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] 認証チェックを実行する", async () => {
    vi.mocked(noteService.getNoteById).mockResolvedValue(null);

    await getNoteByIdQuery({ id: VALID_UUID });

    expect(requireAuthServer).toHaveBeenCalled();
  });

  it("[Success] ノートが見つからない場合はnullを返す", async () => {
    vi.mocked(noteService.getNoteById).mockResolvedValue(null);

    const result = await getNoteByIdQuery({ id: VALID_UUID });

    expect(result).toBeNull();
  });

  it("[Success] ノートを正しく返す", async () => {
    vi.mocked(noteService.getNoteById).mockResolvedValue(mockNoteResponse);

    const result = await getNoteByIdQuery({ id: VALID_UUID });

    expect(result).toEqual(mockNoteResponse);
    expect(noteService.getNoteById).toHaveBeenCalledWith(VALID_UUID);
  });

  it("[Fail] 不正なUUIDでエラーになる", async () => {
    await expect(getNoteByIdQuery({ id: "invalid-uuid" })).rejects.toThrow();
  });

  it("[Fail] idが空文字でエラーになる", async () => {
    await expect(getNoteByIdQuery({ id: "" })).rejects.toThrow();
  });
});

// =============================================================================
// listNoteQuery
// =============================================================================
describe("listNoteQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] 認証チェックを実行する", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([]);

    await listNoteQuery();

    expect(requireAuthServer).toHaveBeenCalled();
  });

  it("[Success] フィルタなしでノート一覧を取得できる", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([mockNoteResponse]);

    const result = await listNoteQuery();

    expect(result).toHaveLength(1);
    expect(noteService.getNotes).toHaveBeenCalledWith(undefined);
  });

  it("[Success] フィルタ付きでノート一覧を取得できる", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([mockNoteResponse]);

    await listNoteQuery({ status: "Draft", q: "検索" });

    expect(noteService.getNotes).toHaveBeenCalledWith({
      status: "Draft",
      q: "検索",
    });
  });

  it("[Success] 空の配列を返す場合も正常に動作する", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([]);

    const result = await listNoteQuery();

    expect(result).toHaveLength(0);
  });

  it("[Fail] 不正なstatusでエラーになる", async () => {
    await expect(
      listNoteQuery({ status: "InvalidStatus" as "Draft" }),
    ).rejects.toThrow();
  });
});

// =============================================================================
// listMyNoteQuery
// =============================================================================
describe("listMyNoteQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Success] accountIdを使ってノート一覧を取得する", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([mockNoteResponse]);

    const result = await listMyNoteQuery(undefined, OWNER_UUID);

    expect(result).toHaveLength(1);
    expect(noteService.getNotes).toHaveBeenCalledWith({
      ownerId: OWNER_UUID,
    });
  });

  it("[Success] フィルタとaccountIdを組み合わせて取得できる", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([mockNoteResponse]);

    await listMyNoteQuery({ status: "Publish" }, OWNER_UUID);

    expect(noteService.getNotes).toHaveBeenCalledWith({
      status: "Publish",
      ownerId: OWNER_UUID,
    });
  });

  it("[Success] 空の配列を返す場合も正常に動作する", async () => {
    vi.mocked(noteService.getNotes).mockResolvedValue([]);

    const result = await listMyNoteQuery(undefined, OWNER_UUID);

    expect(result).toHaveLength(0);
  });

  it("[Fail] 不正なstatusでエラーになる", async () => {
    await expect(
      listMyNoteQuery({ status: "InvalidStatus" as "Draft" }, OWNER_UUID),
    ).rejects.toThrow();
  });
});
