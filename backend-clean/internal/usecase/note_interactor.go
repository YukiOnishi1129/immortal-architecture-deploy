// Package usecase contains application use case implementations.
package usecase

import (
	"context"
	"strings"

	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/internal/domain/service"
	"immortal-architecture-clean/backend/internal/domain/template"
	"immortal-architecture-clean/backend/internal/port"
)

// NoteInteractor handles note use cases.
type NoteInteractor struct {
	notes     port.NoteRepository
	templates port.TemplateRepository
	tx        port.TxManager
	output    port.NoteOutputPort
}

var _ port.NoteInputPort = (*NoteInteractor)(nil)

// NewNoteInteractor creates NoteInteractor.
func NewNoteInteractor(notes port.NoteRepository, templates port.TemplateRepository, tx port.TxManager, output port.NoteOutputPort) *NoteInteractor {
	return &NoteInteractor{
		notes:     notes,
		templates: templates,
		tx:        tx,
		output:    output,
	}
}

// List returns notes by filters.
func (u *NoteInteractor) List(ctx context.Context, filters note.Filters) error {
	notes, err := u.notes.List(ctx, filters)
	if err != nil {
		return err
	}
	return u.output.PresentNoteList(ctx, notes)
}

// Get returns note by ID.
func (u *NoteInteractor) Get(ctx context.Context, id string) error {
	n, err := u.notes.Get(ctx, id)
	if err != nil {
		return err
	}
	return u.output.PresentNote(ctx, n)
}

// Create creates a note.
func (u *NoteInteractor) Create(ctx context.Context, input port.NoteCreateInput) error {
	if input.OwnerID == "" {
		return domainerr.ErrOwnerRequired
	}

	tpl, err := u.templates.Get(ctx, input.TemplateID)
	if err != nil {
		return err
	}

	sections, err := buildSections("", input.Sections)
	if err != nil {
		return err
	}
	if err := note.ValidateNoteForCreate(input.Title, tpl.Template, sections); err != nil {
		return err
	}

	var noteID string
	err = u.tx.WithinTransaction(ctx, func(txCtx context.Context) error {
		newNote := note.Note{
			Title:      input.Title,
			TemplateID: tpl.Template.ID,
			OwnerID:    input.OwnerID,
			Status:     note.StatusDraft,
			Sections:   sections,
		}
		nn, err := u.notes.Create(txCtx, newNote)
		if err != nil {
			return err
		}
		noteID = nn.ID
		sectionsWithID, err := buildSections(noteID, input.Sections)
		if err != nil {
			return err
		}
		if err := note.ValidateSections(tpl.Template.Fields, sectionsWithID); err != nil {
			return err
		}
		return u.notes.ReplaceSections(txCtx, noteID, sectionsWithID)
	})
	if err != nil {
		return err
	}
	n, err := u.notes.Get(ctx, noteID)
	if err != nil {
		return err
	}
	return u.output.PresentNote(ctx, n)
}

// Update updates a note.
func (u *NoteInteractor) Update(ctx context.Context, input port.NoteUpdateInput) error {
	current, err := u.notes.Get(ctx, input.ID)
	if err != nil {
		return err
	}
	if err := note.ValidateNoteOwnership(current.Note.OwnerID, input.OwnerID); err != nil {
		return err
	}
	if strings.TrimSpace(input.Title) == "" {
		return domainerr.ErrTitleRequired
	}

	err = u.tx.WithinTransaction(ctx, func(txCtx context.Context) error {
		_, err := u.notes.Update(txCtx, note.Note{
			ID:    input.ID,
			Title: input.Title,
		})
		if err != nil {
			return err
		}
		if input.Sections != nil {
			tpl, err := u.templates.Get(ctx, current.Note.TemplateID)
			if err != nil {
				return err
			}
			sections, err := buildSectionsForUpdate(current.Sections, tpl.Template.Fields, input.Sections, current.Note.ID)
			if err != nil {
				return err
			}
			if err := note.ValidateSections(tpl.Template.Fields, sections); err != nil {
				return err
			}
			if err := u.notes.ReplaceSections(txCtx, input.ID, sections); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	n, err := u.notes.Get(ctx, input.ID)
	if err != nil {
		return err
	}
	return u.output.PresentNote(ctx, n)
}

// ChangeStatus changes note status.
func (u *NoteInteractor) ChangeStatus(ctx context.Context, input port.NoteStatusChangeInput) error {
	current, err := u.notes.Get(ctx, input.ID)
	if err != nil {
		return err
	}
	if err := note.ValidateNoteOwnership(current.Note.OwnerID, input.OwnerID); err != nil {
		return err
	}
	if err := input.Status.Validate(); err != nil {
		return err
	}
	// domain service handles owner check + transition rule
	if input.Status == note.StatusPublish {
		if err := service.CanPublish(current.Note, input.OwnerID); err != nil {
			return err
		}
	} else {
		if err := service.CanUnpublish(current.Note, input.OwnerID); err != nil {
			return err
		}
	}
	if err := note.CanChangeStatus(current.Note.Status, input.Status); err != nil {
		return err
	}

	if _, err := u.notes.UpdateStatus(ctx, input.ID, input.Status); err != nil {
		return err
	}
	n, err := u.notes.Get(ctx, input.ID)
	if err != nil {
		return err
	}
	return u.output.PresentNote(ctx, n)
}

// Delete deletes a note.
func (u *NoteInteractor) Delete(ctx context.Context, id, ownerID string) error {
	current, err := u.notes.Get(ctx, id)
	if err != nil {
		return err
	}
	if err := note.ValidateNoteOwnership(current.Note.OwnerID, ownerID); err != nil {
		return err
	}
	if err := u.notes.Delete(ctx, id); err != nil {
		return err
	}
	return u.output.PresentNoteDeleted(ctx)
}

func buildSections(noteID string, inputs []port.SectionInput) ([]note.Section, error) {
	if len(inputs) == 0 {
		return nil, domainerr.ErrSectionsMissing
	}

	sections := make([]note.Section, 0, len(inputs))
	for _, s := range inputs {
		sections = append(sections, note.Section{
			FieldID: s.FieldID,
			NoteID:  noteID,
			Content: s.Content,
		})
	}
	return sections, nil
}

// buildSectionsForUpdate maps update inputs to sections using existing sections' field IDs.
func buildSectionsForUpdate(existing []note.SectionWithField, templateFields []template.Field, inputs []port.SectionUpdateInput, noteID string) ([]note.Section, error) {
	// map SectionID -> FieldID from existing
	fieldBySection := make(map[string]string, len(existing))
	for _, s := range existing {
		fieldBySection[s.Section.ID] = s.Section.FieldID
	}
	sections := make([]note.Section, 0, len(inputs))
	for _, in := range inputs {
		fieldID, ok := fieldBySection[in.SectionID]
		if !ok {
			return nil, domainerr.ErrSectionsMissing
		}
		sections = append(sections, note.Section{
			ID:      in.SectionID,
			FieldID: fieldID,
			NoteID:  noteID,
			Content: in.Content,
		})
	}
	// Validate against template fields (reuse existing builder to check missing fields)
	if err := note.ValidateSections(templateFields, sections); err != nil {
		return nil, err
	}
	return sections, nil
}
