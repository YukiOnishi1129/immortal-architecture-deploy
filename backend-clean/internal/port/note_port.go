// Package port defines application ports (interfaces).
package port

import (
	"context"

	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/internal/domain/template"
)

// NoteInputPort defines note use case inputs.
type NoteInputPort interface {
	List(ctx context.Context, filters note.Filters) error
	Get(ctx context.Context, id string) error
	Create(ctx context.Context, input NoteCreateInput) error
	Update(ctx context.Context, input NoteUpdateInput) error
	ChangeStatus(ctx context.Context, input NoteStatusChangeInput) error
	Delete(ctx context.Context, id, ownerID string) error
}

// NoteOutputPort defines note presenters.
type NoteOutputPort interface {
	PresentNoteList(ctx context.Context, notes []note.WithMeta) error
	PresentNote(ctx context.Context, note *note.WithMeta) error
	PresentNoteDeleted(ctx context.Context) error
}

// NoteRepository abstracts note persistence.
type NoteRepository interface {
	List(ctx context.Context, filters note.Filters) ([]note.WithMeta, error)
	Get(ctx context.Context, id string) (*note.WithMeta, error)
	Create(ctx context.Context, n note.Note) (*note.Note, error)
	Update(ctx context.Context, n note.Note) (*note.Note, error)
	UpdateStatus(ctx context.Context, id string, status note.NoteStatus) (*note.Note, error)
	Delete(ctx context.Context, id string) error
	ReplaceSections(ctx context.Context, noteID string, sections []note.Section) error
}

// NoteCreateInput is input for creating notes.
type NoteCreateInput struct {
	Title      string
	TemplateID string
	OwnerID    string
	Sections   []SectionInput
}

// SectionInput is input for creating sections.
type SectionInput struct {
	FieldID string
	Content string
}

// NoteUpdateInput is input for updating notes.
type NoteUpdateInput struct {
	ID       string
	Title    string
	OwnerID  string
	Sections []SectionUpdateInput
}

// SectionUpdateInput is input for updating sections.
type SectionUpdateInput struct {
	SectionID string
	Content   string
}

// NoteStatusChangeInput is input for status changes.
type NoteStatusChangeInput struct {
	ID      string
	OwnerID string
	Status  note.NoteStatus
}

// NoteFilters aliases domain note.Filters
// NoteWithMeta aliases domain note.WithMeta
// TemplateFields aliases template.Field slice

// NoteFilters aliases domain note.Filters.
type NoteFilters = note.Filters

// NoteWithMeta aliases domain note.WithMeta.
type NoteWithMeta = note.WithMeta

// TemplateFields aliases template.Field slice.
type TemplateFields = []template.Field
