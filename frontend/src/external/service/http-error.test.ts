import { describe, expect, it, vi } from "vitest";
import type { ResponseError } from "@/external/client/api/generated/runtime";
import {
  isNotFoundError,
  isResponseError,
  readErrorMessage,
} from "./http-error";

// =============================================================================
// isResponseError
// =============================================================================
describe("isResponseError", () => {
  it("[Success] ResponseErrorオブジェクトの場合、trueを返す", () => {
    const error = {
      response: { status: 404 },
    };

    expect(isResponseError(error)).toBe(true);
  });

  it("[Fail] nullの場合、falseを返す", () => {
    expect(isResponseError(null)).toBe(false);
  });

  it("[Fail] undefinedの場合、falseを返す", () => {
    expect(isResponseError(undefined)).toBe(false);
  });

  it("[Fail] プリミティブ値の場合、falseを返す", () => {
    expect(isResponseError("error")).toBe(false);
    expect(isResponseError(123)).toBe(false);
    expect(isResponseError(true)).toBe(false);
  });

  it("[Fail] responseプロパティがないオブジェクトの場合、falseを返す", () => {
    const error = { message: "error" };

    expect(isResponseError(error)).toBe(false);
  });

  it("[Fail] response.statusがundefinedの場合、falseを返す", () => {
    const error = { response: {} };

    expect(isResponseError(error)).toBe(false);
  });

  it("[Fail] response.statusが数値でない場合、falseを返す", () => {
    const error = { response: { status: "404" } };

    expect(isResponseError(error)).toBe(false);
  });
});

// =============================================================================
// isNotFoundError
// =============================================================================
describe("isNotFoundError", () => {
  it("[Success] 404エラーの場合、trueを返す", () => {
    const error = {
      response: { status: 404 },
    };

    expect(isNotFoundError(error)).toBe(true);
  });

  it("[Fail] 500エラーの場合、falseを返す", () => {
    const error = {
      response: { status: 500 },
    };

    expect(isNotFoundError(error)).toBe(false);
  });

  it("[Fail] 400エラーの場合、falseを返す", () => {
    const error = {
      response: { status: 400 },
    };

    expect(isNotFoundError(error)).toBe(false);
  });

  it("[Fail] 403エラーの場合、falseを返す", () => {
    const error = {
      response: { status: 403 },
    };

    expect(isNotFoundError(error)).toBe(false);
  });

  it("[Fail] ResponseErrorでない場合、falseを返す", () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError({ message: "error" })).toBe(false);
  });
});

// =============================================================================
// readErrorMessage
// =============================================================================
describe("readErrorMessage", () => {
  it("[Success] JSONレスポンスからmessageを取得できる", async () => {
    const mockResponse = {
      clone: vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ message: "エラーメッセージ" }),
      }),
    } as unknown as Response;

    const error = { response: mockResponse } as ResponseError;

    const result = await readErrorMessage(error);

    expect(result).toBe("エラーメッセージ");
  });

  it("[Fail] JSONパースに失敗した場合、undefinedを返す", async () => {
    const mockResponse = {
      clone: vi.fn().mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error("JSON parse error")),
      }),
    } as unknown as Response;

    const error = { response: mockResponse } as ResponseError;

    const result = await readErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("[Fail] messageプロパティが文字列でない場合、undefinedを返す", async () => {
    const mockResponse = {
      clone: vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ message: 123 }),
      }),
    } as unknown as Response;

    const error = { response: mockResponse } as ResponseError;

    const result = await readErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("[Fail] messageプロパティがない場合、undefinedを返す", async () => {
    const mockResponse = {
      clone: vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ error: "何かのエラー" }),
      }),
    } as unknown as Response;

    const error = { response: mockResponse } as ResponseError;

    const result = await readErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it("[Fail] bodyがnullの場合、undefinedを返す", async () => {
    const mockResponse = {
      clone: vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue(null),
      }),
    } as unknown as Response;

    const error = { response: mockResponse } as ResponseError;

    const result = await readErrorMessage(error);

    expect(result).toBeUndefined();
  });
});
