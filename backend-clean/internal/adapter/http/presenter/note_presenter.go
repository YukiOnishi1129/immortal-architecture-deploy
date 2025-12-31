// Package presenter contains HTTP presenters that implement output ports.
package presenter

import (
	"context"

	openapi "immortal-architecture-clean/backend/internal/adapter/http/generated/openapi"
	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/internal/port"
)

// NotePresenter converts note domain models to OpenAPI responses.
type NotePresenter struct {
	note      *openapi.ModelsNoteResponse
	notes     []openapi.ModelsNoteResponse
	deletedOK bool
}

var _ port.NoteOutputPort = (*NotePresenter)(nil)

// NewNotePresenter creates a new NotePresenter.
func NewNotePresenter() *NotePresenter {
	return &NotePresenter{}
}

// PresentNoteList stores note list response.
func (p *NotePresenter) PresentNoteList(_ context.Context, notes []note.WithMeta) error {
	res := make([]openapi.ModelsNoteResponse, 0, len(notes))
	for _, n := range notes {
		res = append(res, toNoteResponse(n))
	}
	p.notes = res
	return nil
}

// PresentNote stores single note response.
func (p *NotePresenter) PresentNote(_ context.Context, n *note.WithMeta) error {
	resp := toNoteResponse(*n)
	p.note = &resp
	return nil
}

// PresentNoteDeleted marks delete success.
func (p *NotePresenter) PresentNoteDeleted(_ context.Context) error {
	p.deletedOK = true
	return nil
}

// Note returns the last note response.
func (p *NotePresenter) Note() *openapi.ModelsNoteResponse {
	return p.note
}

// Notes returns the note list response.
func (p *NotePresenter) Notes() []openapi.ModelsNoteResponse {
	return p.notes
}

// DeleteResponse returns deletion success response.
func (p *NotePresenter) DeleteResponse() openapi.ModelsSuccessResponse {
	return openapi.ModelsSuccessResponse{Success: p.deletedOK}
}

func toNoteResponse(n note.WithMeta) openapi.ModelsNoteResponse {
	sections := make([]openapi.ModelsSection, 0, len(n.Sections))
	for _, s := range n.Sections {
		sections = append(sections, openapi.ModelsSection{
			Id:         s.Section.ID,
			FieldId:    s.Section.FieldID,
			FieldLabel: s.FieldLabel,
			Content:    s.Section.Content,
			IsRequired: s.IsRequired,
		})
	}
	return openapi.ModelsNoteResponse{
		Id:           n.Note.ID,
		Title:        n.Note.Title,
		TemplateId:   n.Note.TemplateID,
		TemplateName: n.TemplateName,
		OwnerId:      n.Note.OwnerID,
		Owner: openapi.ModelsAccountSummary{
			Id:        n.Note.OwnerID,
			FirstName: n.OwnerFirstName,
			LastName:  n.OwnerLastName,
			Thumbnail: n.OwnerThumbnail,
		},
		Status:    openapi.ModelsNoteStatus(n.Note.Status),
		Sections:  sections,
		CreatedAt: n.Note.CreatedAt,
		UpdatedAt: n.Note.UpdatedAt,
	}
}
