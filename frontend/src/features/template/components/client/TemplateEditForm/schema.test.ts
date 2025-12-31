import { describe, expect, it } from "vitest";
import { templateEditFormSchema, templateFieldSchema } from "./schema";

// =============================================================================
// templateFieldSchema (TemplateEditForm)
// =============================================================================
describe("templateFieldSchema", () => {
  const validField = {
    id: "field-1",
    label: "項目名",
    isRequired: false,
    order: 0,
  };

  it("[Success] 有効なフィールドでパースできる", () => {
    const result = templateFieldSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });

  it("[Fail] labelが空文字でエラーになる", () => {
    const result = templateFieldSchema.safeParse({
      ...validField,
      label: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("項目名は必須です");
    }
  });
});

// =============================================================================
// templateEditFormSchema
// =============================================================================
describe("templateEditFormSchema", () => {
  const validField = {
    id: "field-1",
    label: "項目名",
    isRequired: false,
    order: 0,
  };

  const validForm = {
    name: "テストテンプレート",
    fields: [validField],
  };

  // ---------------------------------------------------------------------------
  // name
  // ---------------------------------------------------------------------------
  describe("name", () => {
    it("[Success] 有効な名前でパースできる", () => {
      const result = templateEditFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it("[Success] 名前が1文字でパースできる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        name: "a",
      });
      expect(result.success).toBe(true);
    });

    it("[Success] 名前が100文字でパースできる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        name: "a".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] 名前が空文字でエラーになる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        name: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("テンプレート名は必須です");
      }
    });

    it("[Fail] 名前が101文字でエラーになる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        name: "a".repeat(101),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "テンプレート名は100文字以内で入力してください",
        );
      }
    });

    it("[Fail] 名前が未定義でエラーになる", () => {
      const { name: _, ...withoutName } = validForm;
      const result = templateEditFormSchema.safeParse(withoutName);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fields
  // ---------------------------------------------------------------------------
  describe("fields", () => {
    it("[Success] 複数フィールドでパースできる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        fields: [validField, { ...validField, id: "field-2", order: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] fieldsが空配列でエラーになる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        fields: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "少なくとも1つの項目が必要です",
        );
      }
    });

    it("[Fail] fieldsが未定義でエラーになる", () => {
      const { fields: _, ...withoutFields } = validForm;
      const result = templateEditFormSchema.safeParse(withoutFields);
      expect(result.success).toBe(false);
    });

    it("[Fail] fieldsが配列でない場合エラーになる", () => {
      const result = templateEditFormSchema.safeParse({
        ...validForm,
        fields: "not-an-array",
      });
      expect(result.success).toBe(false);
    });
  });
});
