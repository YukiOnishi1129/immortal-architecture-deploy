import { describe, expect, it } from "vitest";
import { noteNewFormSchema, sectionInputSchema } from "./schema";

// =============================================================================
// sectionInputSchema
// =============================================================================
describe("sectionInputSchema", () => {
  const validSection = {
    fieldId: "123e4567-e89b-12d3-a456-426614174000",
    fieldLabel: "項目1",
    content: "内容です",
    isRequired: true,
  };

  it("[Success] 有効なセクションでパースできる", () => {
    const result = sectionInputSchema.safeParse(validSection);
    expect(result.success).toBe(true);
  });

  it("[Success] contentが空文字でもパースできる", () => {
    const result = sectionInputSchema.safeParse({
      ...validSection,
      content: "",
    });
    expect(result.success).toBe(true);
  });

  it("[Fail] fieldIdが不正なUUIDでエラーになる", () => {
    const result = sectionInputSchema.safeParse({
      ...validSection,
      fieldId: "invalid-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("[Fail] fieldIdが未定義でエラーになる", () => {
    const { fieldId: _, ...withoutFieldId } = validSection;
    const result = sectionInputSchema.safeParse(withoutFieldId);
    expect(result.success).toBe(false);
  });

  it("[Fail] fieldLabelが未定義でエラーになる", () => {
    const { fieldLabel: _, ...withoutFieldLabel } = validSection;
    const result = sectionInputSchema.safeParse(withoutFieldLabel);
    expect(result.success).toBe(false);
  });

  it("[Fail] isRequiredが未定義でエラーになる", () => {
    const { isRequired: _, ...withoutIsRequired } = validSection;
    const result = sectionInputSchema.safeParse(withoutIsRequired);
    expect(result.success).toBe(false);
  });

  it("[Fail] isRequiredがbooleanでない場合エラーになる", () => {
    const result = sectionInputSchema.safeParse({
      ...validSection,
      isRequired: "true",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// noteNewFormSchema
// =============================================================================
describe("noteNewFormSchema", () => {
  const validSection = {
    fieldId: "123e4567-e89b-12d3-a456-426614174000",
    fieldLabel: "項目1",
    content: "内容",
    isRequired: false,
  };

  const validForm = {
    title: "テストノート",
    templateId: "223e4567-e89b-12d3-a456-426614174001",
    sections: [validSection],
  };

  // ---------------------------------------------------------------------------
  // title
  // ---------------------------------------------------------------------------
  describe("title", () => {
    it("[Success] 有効なタイトルでパースできる", () => {
      const result = noteNewFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it("[Success] タイトルが1文字でパースできる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        title: "a",
      });
      expect(result.success).toBe(true);
    });

    it("[Success] タイトルが100文字でパースできる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        title: "a".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] タイトルが空文字でエラーになる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        title: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("タイトルは必須です");
      }
    });

    it("[Fail] タイトルが101文字でエラーになる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        title: "a".repeat(101),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "タイトルは100文字以内で入力してください",
        );
      }
    });

    it("[Fail] タイトルが未定義でエラーになる", () => {
      const { title: _, ...withoutTitle } = validForm;
      const result = noteNewFormSchema.safeParse(withoutTitle);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // templateId
  // ---------------------------------------------------------------------------
  describe("templateId", () => {
    it("[Success] 有効なUUIDでパースできる", () => {
      const result = noteNewFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it("[Fail] 不正なUUIDでエラーになる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        templateId: "invalid-uuid",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "テンプレートを選択してください",
        );
      }
    });

    it("[Fail] templateIdが空文字でエラーになる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        templateId: "",
      });
      expect(result.success).toBe(false);
    });

    it("[Fail] templateIdが未定義でエラーになる", () => {
      const { templateId: _, ...withoutTemplateId } = validForm;
      const result = noteNewFormSchema.safeParse(withoutTemplateId);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sections
  // ---------------------------------------------------------------------------
  describe("sections", () => {
    it("[Success] 複数セクションでパースできる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        sections: [
          validSection,
          {
            ...validSection,
            fieldId: "323e4567-e89b-12d3-a456-426614174002",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("[Success] 空のセクション配列でパースできる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        sections: [],
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] sectionsが未定義でエラーになる", () => {
      const { sections: _, ...withoutSections } = validForm;
      const result = noteNewFormSchema.safeParse(withoutSections);
      expect(result.success).toBe(false);
    });

    it("[Fail] sectionsが配列でない場合エラーになる", () => {
      const result = noteNewFormSchema.safeParse({
        ...validForm,
        sections: "not-an-array",
      });
      expect(result.success).toBe(false);
    });
  });
});
