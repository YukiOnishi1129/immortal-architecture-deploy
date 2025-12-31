import { describe, expect, it } from "vitest";
import { templateFieldSchema, templateNewFormSchema } from "./schema";

// =============================================================================
// templateFieldSchema
// =============================================================================
describe("templateFieldSchema", () => {
  const validField = {
    id: "field-1",
    label: "項目名",
    isRequired: true,
    order: 0,
  };

  it("[Success] 有効なフィールドでパースできる", () => {
    const result = templateFieldSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });

  it("[Success] labelが1文字でパースできる", () => {
    const result = templateFieldSchema.safeParse({
      ...validField,
      label: "a",
    });
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

  it("[Fail] idが未定義でエラーになる", () => {
    const { id: _, ...withoutId } = validField;
    const result = templateFieldSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("[Fail] labelが未定義でエラーになる", () => {
    const { label: _, ...withoutLabel } = validField;
    const result = templateFieldSchema.safeParse(withoutLabel);
    expect(result.success).toBe(false);
  });

  it("[Fail] isRequiredが未定義でエラーになる", () => {
    const { isRequired: _, ...withoutIsRequired } = validField;
    const result = templateFieldSchema.safeParse(withoutIsRequired);
    expect(result.success).toBe(false);
  });

  it("[Fail] orderが未定義でエラーになる", () => {
    const { order: _, ...withoutOrder } = validField;
    const result = templateFieldSchema.safeParse(withoutOrder);
    expect(result.success).toBe(false);
  });

  it("[Fail] orderが数値でない場合エラーになる", () => {
    const result = templateFieldSchema.safeParse({
      ...validField,
      order: "1",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] isRequiredがbooleanでない場合エラーになる", () => {
    const result = templateFieldSchema.safeParse({
      ...validField,
      isRequired: "true",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// templateNewFormSchema
// =============================================================================
describe("templateNewFormSchema", () => {
  const validField = {
    id: "field-1",
    label: "項目名",
    isRequired: true,
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
      const result = templateNewFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it("[Success] 名前が1文字でパースできる", () => {
      const result = templateNewFormSchema.safeParse({
        ...validForm,
        name: "a",
      });
      expect(result.success).toBe(true);
    });

    it("[Success] 名前が100文字でパースできる", () => {
      const result = templateNewFormSchema.safeParse({
        ...validForm,
        name: "a".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] 名前が空文字でエラーになる", () => {
      const result = templateNewFormSchema.safeParse({
        ...validForm,
        name: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("テンプレート名は必須です");
      }
    });

    it("[Fail] 名前が101文字でエラーになる", () => {
      const result = templateNewFormSchema.safeParse({
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
      const result = templateNewFormSchema.safeParse(withoutName);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fields
  // ---------------------------------------------------------------------------
  describe("fields", () => {
    it("[Success] 複数フィールドでパースできる", () => {
      const result = templateNewFormSchema.safeParse({
        ...validForm,
        fields: [validField, { ...validField, id: "field-2", order: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] fieldsが空配列でエラーになる", () => {
      const result = templateNewFormSchema.safeParse({
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
      const result = templateNewFormSchema.safeParse(withoutFields);
      expect(result.success).toBe(false);
    });

    it("[Fail] fieldsが配列でない場合エラーになる", () => {
      const result = templateNewFormSchema.safeParse({
        ...validForm,
        fields: "not-an-array",
      });
      expect(result.success).toBe(false);
    });

    it("[Fail] フィールドのlabelが空文字の場合エラーになる", () => {
      const result = templateNewFormSchema.safeParse({
        ...validForm,
        fields: [{ ...validField, label: "" }],
      });
      expect(result.success).toBe(false);
    });
  });
});
