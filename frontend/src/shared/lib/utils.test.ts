import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  // ---------------------------------------------------------------------------
  // 基本的なクラス結合
  // ---------------------------------------------------------------------------
  describe("基本的なクラス結合", () => {
    it("[Success] 単一のクラスを返す", () => {
      expect(cn("text-red-500")).toBe("text-red-500");
    });

    it("[Success] 複数のクラスを結合する", () => {
      expect(cn("text-red-500", "bg-blue-500")).toBe(
        "text-red-500 bg-blue-500",
      );
    });

    it("[Success] 配列のクラスを結合する", () => {
      expect(cn(["text-red-500", "bg-blue-500"])).toBe(
        "text-red-500 bg-blue-500",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 条件付きクラス
  // ---------------------------------------------------------------------------
  describe("条件付きクラス", () => {
    it("[Success] trueの条件でクラスを適用する", () => {
      expect(cn("base", true && "active")).toBe("base active");
    });

    it("[Success] falseの条件でクラスを除外する", () => {
      expect(cn("base", false && "active")).toBe("base");
    });

    it("[Success] nullやundefinedを無視する", () => {
      expect(cn("base", null, undefined, "extra")).toBe("base extra");
    });

    it("[Success] オブジェクト形式の条件を処理する", () => {
      expect(cn("base", { active: true, disabled: false })).toBe("base active");
    });
  });

  // ---------------------------------------------------------------------------
  // Tailwindクラスのマージ
  // ---------------------------------------------------------------------------
  describe("Tailwindクラスのマージ", () => {
    it("[Success] 競合するクラスを後のものに置換する", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("[Success] パディングの競合を解決する", () => {
      expect(cn("p-4", "p-8")).toBe("p-8");
    });

    it("[Success] マージンの競合を解決する", () => {
      expect(cn("m-2", "m-4")).toBe("m-4");
    });

    it("[Success] 異なる方向のマージンは保持する", () => {
      expect(cn("mt-2", "mb-4")).toBe("mt-2 mb-4");
    });

    it("[Success] サイズの競合を解決する", () => {
      expect(cn("w-full", "w-1/2")).toBe("w-1/2");
    });

    it("[Success] フレックスの競合を解決する", () => {
      expect(cn("flex-row", "flex-col")).toBe("flex-col");
    });
  });

  // ---------------------------------------------------------------------------
  // 複雑な組み合わせ
  // ---------------------------------------------------------------------------
  describe("複雑な組み合わせ", () => {
    it("[Success] 配列、オブジェクト、条件を組み合わせる", () => {
      const isActive = true;
      const isDisabled = false;

      expect(
        cn(
          "base-class",
          ["array-class"],
          { conditional: isActive, disabled: isDisabled },
          isActive && "active-class",
        ),
      ).toBe("base-class array-class conditional active-class");
    });

    it("[Success] 空の入力を処理する", () => {
      expect(cn()).toBe("");
    });

    it("[Success] 空文字列を無視する", () => {
      expect(cn("base", "", "extra")).toBe("base extra");
    });
  });
});
