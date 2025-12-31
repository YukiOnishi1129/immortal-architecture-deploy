package presenter

import (
	"context"
	"testing"
	"time"

	"immortal-architecture-clean/backend/internal/domain/note"
)

func TestNotePresenter_TableDriven(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name      string
		action    string
		single    *note.WithMeta
		list      []note.WithMeta
		wantID    string
		wantCount int
	}{
		{
			name:   "[Success] single note",
			action: "single",
			single: &note.WithMeta{
				Note: note.Note{
					ID:         "note-1",
					Title:      "Hello",
					TemplateID: "tpl-1",
					OwnerID:    "owner-1",
					Status:     note.StatusDraft,
					CreatedAt:  now,
					UpdatedAt:  now,
				},
				TemplateName:   "Tpl",
				OwnerFirstName: "Taro",
				OwnerLastName:  "Yamada",
				Sections: []note.SectionWithField{
					{
						Section:    note.Section{ID: "sec1", FieldID: "f1", Content: "c1"},
						FieldLabel: "Title",
						IsRequired: true,
					},
				},
			},
			wantID: "note-1",
		},
		{
			name:      "[Success] list",
			action:    "list",
			list:      []note.WithMeta{{Note: note.Note{ID: "n1"}}, {Note: note.Note{ID: "n2"}}},
			wantCount: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewNotePresenter()
			switch tt.action {
			case "single":
				if err := p.PresentNote(context.Background(), tt.single); err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				resp := p.Note()
				if resp == nil || resp.Id != tt.wantID || resp.OwnerId != tt.single.Note.OwnerID {
					t.Fatalf("unexpected response: %+v", resp)
				}
				if len(resp.Sections) != len(tt.single.Sections) {
					t.Fatalf("sections not mapped: %+v", resp.Sections)
				}
			case "list":
				_ = p.PresentNoteList(context.Background(), tt.list)
				if len(p.Notes()) != tt.wantCount {
					t.Fatalf("want %d notes, got %d", tt.wantCount, len(p.Notes()))
				}
			}
		})
	}
}

func TestNotePresenter_PresentNoteDeleted(t *testing.T) {
	p := NewNotePresenter()
	_ = p.PresentNoteDeleted(context.Background())
	if !p.DeleteResponse().Success {
		t.Fatalf("delete flag not set")
	}
}
