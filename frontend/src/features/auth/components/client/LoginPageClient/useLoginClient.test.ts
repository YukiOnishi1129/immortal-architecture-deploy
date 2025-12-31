import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// better-auth-client モック - vi.hoisted使用
const { mockSignInSocial } = vi.hoisted(() => ({
  mockSignInSocial: vi.fn(),
}));

vi.mock("@/features/auth/lib/better-auth-client", () => ({
  signIn: {
    social: mockSignInSocial,
  },
}));

import { useLoginClient } from "./useLoginClient";

describe("useLoginClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInSocial.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // handleGoogleLogin
  // ---------------------------------------------------------------------------
  describe("handleGoogleLogin", () => {
    it("[Success] Googleログインを呼び出す", async () => {
      const { result } = renderHook(() => useLoginClient());

      await act(async () => {
        await result.current.handleGoogleLogin();
      });

      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/notes",
      });
    });

    it("[Success] signIn.socialが正しいパラメータで呼び出される", async () => {
      const { result } = renderHook(() => useLoginClient());

      await act(async () => {
        await result.current.handleGoogleLogin();
      });

      expect(mockSignInSocial).toHaveBeenCalledTimes(1);
      const callArgs = mockSignInSocial.mock.calls[0][0];
      expect(callArgs.provider).toBe("google");
      expect(callArgs.callbackURL).toBe("/notes");
    });
  });
});
