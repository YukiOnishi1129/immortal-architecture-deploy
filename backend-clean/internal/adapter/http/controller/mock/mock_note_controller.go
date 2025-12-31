package mock

import (
	"context"

	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/internal/port"
)

// NoteInputStub is a lightweight stub for note use case input.
type NoteInputStub struct {
	Err      error
	Output   port.NoteOutputPort
	Notes    []note.WithMeta
	NoteResp *note.WithMeta
}

func (s *NoteInputStub) List(ctx context.Context, filters note.Filters) error {
	if s.Output != nil && s.Err == nil {
		_ = s.Output.PresentNoteList(ctx, s.Notes)
	}
	return s.Err
}

func (s *NoteInputStub) Get(ctx context.Context, id string) error {
	if s.Output != nil && s.Err == nil {
		resp := s.NoteResp
		if resp == nil {
			resp = &note.WithMeta{Note: note.Note{ID: id}}
		}
		_ = s.Output.PresentNote(ctx, resp)
	}
	return s.Err
}

func (s *NoteInputStub) Create(ctx context.Context, input port.NoteCreateInput) error {
	if s.Output != nil && s.Err == nil {
		_ = s.Output.PresentNote(ctx, &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: input.OwnerID}})
	}
	return s.Err
}

func (s *NoteInputStub) Update(ctx context.Context, input port.NoteUpdateInput) error {
	if s.Output != nil && s.Err == nil {
		_ = s.Output.PresentNote(ctx, &note.WithMeta{Note: note.Note{ID: input.ID, OwnerID: input.OwnerID}})
	}
	return s.Err
}

func (s *NoteInputStub) ChangeStatus(ctx context.Context, input port.NoteStatusChangeInput) error {
	if s.Output != nil && s.Err == nil {
		_ = s.Output.PresentNote(ctx, &note.WithMeta{Note: note.Note{ID: input.ID, OwnerID: input.OwnerID, Status: input.Status}})
	}
	return s.Err
}

func (s *NoteInputStub) Delete(ctx context.Context, id, ownerID string) error {
	if s.Output != nil && s.Err == nil {
		_ = s.Output.PresentNoteDeleted(ctx)
	}
	return s.Err
}
