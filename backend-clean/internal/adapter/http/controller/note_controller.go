// Package controller contains HTTP controllers.
package controller

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	openapi "immortal-architecture-clean/backend/internal/adapter/http/generated/openapi"
	"immortal-architecture-clean/backend/internal/adapter/http/presenter"
	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/internal/port"
)

// NoteController handles note HTTP endpoints.
type NoteController struct {
	inputFactory    func(noteRepo port.NoteRepository, tplRepo port.TemplateRepository, tx port.TxManager, output port.NoteOutputPort) port.NoteInputPort
	outputFactory   func() *presenter.NotePresenter
	noteRepoFactory func() port.NoteRepository
	tplRepoFactory  func() port.TemplateRepository
	txFactory       func() port.TxManager
}

// NewNoteController creates NoteController.
func NewNoteController(
	inputFactory func(noteRepo port.NoteRepository, tplRepo port.TemplateRepository, tx port.TxManager, output port.NoteOutputPort) port.NoteInputPort,
	outputFactory func() *presenter.NotePresenter,
	noteRepoFactory func() port.NoteRepository,
	tplRepoFactory func() port.TemplateRepository,
	txFactory func() port.TxManager,
) *NoteController {
	return &NoteController{
		inputFactory:    inputFactory,
		outputFactory:   outputFactory,
		noteRepoFactory: noteRepoFactory,
		tplRepoFactory:  tplRepoFactory,
		txFactory:       txFactory,
	}
}

// List handles listing notes with optional filters.
// List handles GET /notes.
func (c *NoteController) List(ctx echo.Context, params openapi.NotesListNotesParams) error {
	var status *note.NoteStatus
	if params.Status != nil {
		s := note.NoteStatus(*params.Status)
		status = &s
	}
	filters := note.Filters{
		Status:     status,
		TemplateID: params.TemplateId,
		OwnerID:    params.OwnerId,
		Query:      params.Q,
	}
	input, p := c.newIO()
	if err := input.List(ctx.Request().Context(), filters); err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.Notes())
}

// GetByID handles GET /notes/:id.
func (c *NoteController) GetByID(ctx echo.Context, noteID string) error {
	input, p := c.newIO()
	if err := input.Get(ctx.Request().Context(), noteID); err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.Note())
}

// Create handles creating a new note.
// Create handles POST /notes.
func (c *NoteController) Create(ctx echo.Context) error {
	var body openapi.ModelsCreateNoteRequest
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, openapi.ModelsBadRequestError{Code: openapi.ModelsBadRequestErrorCodeBADREQUEST, Message: "invalid body"})
	}
	ownerID := body.OwnerId.String()
	sections := []port.SectionInput{}
	if body.Sections != nil {
		for _, s := range *body.Sections {
			sections = append(sections, port.SectionInput{
				FieldID: s.FieldId,
				Content: s.Content,
			})
		}
	}
	input, p := c.newIO()
	err := input.Create(ctx.Request().Context(), port.NoteCreateInput{
		Title:      body.Title,
		TemplateID: body.TemplateId.String(),
		OwnerID:    ownerID,
		Sections:   sections,
	})
	if err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.Note())
}

// Update handles updating a note.
// Update handles PUT /notes/:id.
func (c *NoteController) Update(ctx echo.Context, noteID string, params openapi.NotesUpdateNoteParams) error {
	var body openapi.ModelsUpdateNoteRequest
	if err := ctx.Bind(&body); err != nil {
		return ctx.JSON(http.StatusBadRequest, openapi.ModelsBadRequestError{Code: openapi.ModelsBadRequestErrorCodeBADREQUEST, Message: "invalid body"})
	}
	ownerID := strings.TrimSpace(params.OwnerId)
	if ownerID == "" {
		return handleError(ctx, domainerr.ErrUnauthorized)
	}
	sections := make([]port.SectionUpdateInput, 0, len(body.Sections))
	for _, s := range body.Sections {
		sections = append(sections, port.SectionUpdateInput{
			SectionID: s.Id,
			Content:   s.Content,
		})
	}
	input, p := c.newIO()
	err := input.Update(ctx.Request().Context(), port.NoteUpdateInput{
		ID:       noteID,
		Title:    body.Title,
		OwnerID:  ownerID,
		Sections: sections,
	})
	if err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.Note())
}

// Delete handles deleting a note.
// Delete handles DELETE /notes/:id.
func (c *NoteController) Delete(ctx echo.Context, noteID string, params openapi.NotesDeleteNoteParams) error {
	ownerID := strings.TrimSpace(params.OwnerId)
	if ownerID == "" {
		return handleError(ctx, domainerr.ErrUnauthorized)
	}
	input, p := c.newIO()
	if err := input.Delete(ctx.Request().Context(), noteID, ownerID); err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.DeleteResponse())
}

// Publish handles publishing a note.
// Publish handles POST /notes/:id/publish.
func (c *NoteController) Publish(ctx echo.Context, noteID string, params openapi.NotesPublishNoteParams) error {
	ownerID := strings.TrimSpace(params.OwnerId)
	if ownerID == "" {
		return handleError(ctx, domainerr.ErrOwnerRequired)
	}
	input, p := c.newIO()
	err := input.ChangeStatus(ctx.Request().Context(), port.NoteStatusChangeInput{
		ID:      noteID,
		Status:  note.StatusPublish,
		OwnerID: ownerID,
	})
	if err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.Note())
}

// Unpublish handles unpublishing a note.
// Unpublish handles POST /notes/:id/unpublish.
func (c *NoteController) Unpublish(ctx echo.Context, noteID string, params openapi.NotesUnpublishNoteParams) error {
	ownerID := strings.TrimSpace(params.OwnerId)
	if ownerID == "" {
		return handleError(ctx, domainerr.ErrOwnerRequired)
	}
	input, p := c.newIO()
	err := input.ChangeStatus(ctx.Request().Context(), port.NoteStatusChangeInput{
		ID:      noteID,
		Status:  note.StatusDraft,
		OwnerID: ownerID,
	})
	if err != nil {
		return handleError(ctx, err)
	}
	return ctx.JSON(http.StatusOK, p.Note())
}

func (c *NoteController) newIO() (port.NoteInputPort, *presenter.NotePresenter) {
	output := c.outputFactory()
	input := c.inputFactory(c.noteRepoFactory(), c.tplRepoFactory(), c.txFactory(), output)
	return input, output
}
