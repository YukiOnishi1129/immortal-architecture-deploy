import { describe, expect, it } from "vitest";
import { NoteEditFormSchema } from "./schema";

// =============================================================================
// NoteEditFormSchema
// =============================================================================
describe("NoteEditFormSchema", () => {
  const validSection = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    fieldId: "223e4567-e89b-12d3-a456-426614174001",
    fieldLabel: "項目1",
    content: "内容です",
    isRequired: true,
  };

  const validForm = {
    title: "テストノート",
    sections: [validSection],
  };

  // ---------------------------------------------------------------------------
  // title
  // ---------------------------------------------------------------------------
  describe("title", () => {
    it("[Success] 有効なタイトルでパースできる", () => {
      const result = NoteEditFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
    });

    it("[Success] タイトルが1文字でパースできる", () => {
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        title: "a",
      });
      expect(result.success).toBe(true);
    });

    it("[Success] タイトルが100文字でパースできる", () => {
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        title: "a".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] タイトルが空文字でエラーになる", () => {
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        title: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("タイトルは必須です");
      }
    });

    it("[Fail] タイトルが101文字でエラーになる", () => {
      const result = NoteEditFormSchema.safeParse({
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
      const result = NoteEditFormSchema.safeParse(withoutTitle);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sections
  // ---------------------------------------------------------------------------
  describe("sections", () => {
    it("[Success] 複数セクションでパースできる", () => {
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: [
          validSection,
          {
            ...validSection,
            id: "323e4567-e89b-12d3-a456-426614174002",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("[Success] 空のセクション配列でパースできる", () => {
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: [],
      });
      expect(result.success).toBe(true);
    });

    it("[Fail] sectionsが未定義でエラーになる", () => {
      const { sections: _, ...withoutSections } = validForm;
      const result = NoteEditFormSchema.safeParse(withoutSections);
      expect(result.success).toBe(false);
    });

    it("[Fail] sectionsが配列でない場合エラーになる", () => {
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: "not-an-array",
      });
      expect(result.success).toBe(false);
    });

    it("[Fail] セクションにidが欠けている場合エラーになる", () => {
      const { id: _, ...sectionWithoutId } = validSection;
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: [sectionWithoutId],
      });
      expect(result.success).toBe(false);
    });

    it("[Fail] セクションにfieldIdが欠けている場合エラーになる", () => {
      const { fieldId: _, ...sectionWithoutFieldId } = validSection;
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: [sectionWithoutFieldId],
      });
      expect(result.success).toBe(false);
    });

    it("[Fail] セクションにfieldLabelが欠けている場合エラーになる", () => {
      const { fieldLabel: _, ...sectionWithoutFieldLabel } = validSection;
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: [sectionWithoutFieldLabel],
      });
      expect(result.success).toBe(false);
    });

    it("[Fail] セクションにisRequiredが欠けている場合エラーになる", () => {
      const { isRequired: _, ...sectionWithoutIsRequired } = validSection;
      const result = NoteEditFormSchema.safeParse({
        ...validForm,
        sections: [sectionWithoutIsRequired],
      });
      expect(result.success).toBe(false);
    });
  });
});
