package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"

	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/internal/domain/template"
	"immortal-architecture-clean/backend/internal/port"
	uc "immortal-architecture-clean/backend/internal/usecase"
	mockusecase "immortal-architecture-clean/backend/internal/usecase/mock"
)

func TestNoteInteractor_List(t *testing.T) {
	tests := []struct {
		name      string
		filters   note.Filters
		result    []note.WithMeta
		repoErr   error
		wantError error
	}{
		{
			name:    "[Success] list notes",
			filters: note.Filters{OwnerID: strPtr("owner")},
			result:  []note.WithMeta{{Note: note.Note{ID: "n1"}}},
		},
		{
			name:      "[Fail] repo error",
			filters:   note.Filters{},
			repoErr:   errors.New("repo err"),
			wantError: errors.New("repo err"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			notes := mockusecase.NewMockNoteRepository(ctrl)
			templates := mockusecase.NewMockTemplateRepository(ctrl)
			tx := mockusecase.NewMockTxManager(ctrl)
			out := mockusecase.NewMockNoteOutputPort(ctrl)

			notes.EXPECT().List(gomock.Any(), tt.filters).Return(tt.result, tt.repoErr)
			if tt.repoErr == nil {
				out.EXPECT().PresentNoteList(gomock.Any(), tt.result).Return(nil)
			}

			interactor := uc.NewNoteInteractor(notes, templates, tx, out)
			err := interactor.List(context.Background(), tt.filters)

			if tt.wantError == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantError != nil && (err == nil || tt.wantError.Error() != err.Error()) {
				t.Fatalf("want %v, got %v", tt.wantError, err)
			}
		})
	}
}

func TestNoteInteractor_Get(t *testing.T) {
	tests := []struct {
		name      string
		id        string
		result    *note.WithMeta
		repoErr   error
		wantError error
	}{
		{
			name:   "[Success] get note",
			id:     "n1",
			result: &note.WithMeta{Note: note.Note{ID: "n1"}},
		},
		{
			name:      "[Fail] not found",
			id:        "missing",
			repoErr:   domainerr.ErrNotFound,
			wantError: domainerr.ErrNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			notes := mockusecase.NewMockNoteRepository(ctrl)
			templates := mockusecase.NewMockTemplateRepository(ctrl)
			tx := mockusecase.NewMockTxManager(ctrl)
			out := mockusecase.NewMockNoteOutputPort(ctrl)

			notes.EXPECT().Get(gomock.Any(), tt.id).Return(tt.result, tt.repoErr)
			if tt.repoErr == nil {
				out.EXPECT().PresentNote(gomock.Any(), tt.result).Return(nil)
			}

			interactor := uc.NewNoteInteractor(notes, templates, tx, out)
			err := interactor.Get(context.Background(), tt.id)

			if tt.wantError == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantError != nil && !errors.Is(err, tt.wantError) {
				t.Fatalf("want %v, got %v", tt.wantError, err)
			}
		})
	}
}

func TestNoteInteractor_Create(t *testing.T) {
	templateFields := []template.Field{{ID: "f1", Label: "Title", Order: 1, IsRequired: false}}
	validSections := []port.SectionInput{{FieldID: "f1", Content: "content"}}
	tests := []struct {
		name        string
		input       port.NoteCreateInput
		tpl         *template.WithUsage
		getTplErr   error
		createErr   error
		replaceErr  error
		wantError   error
		expectTxRun bool
	}{
		{
			name: "[Success] create with sections",
			input: port.NoteCreateInput{
				Title:      "Hello",
				TemplateID: "tpl-1",
				OwnerID:    "owner-1",
				Sections:   validSections,
			},
			tpl: &template.WithUsage{
				Template: template.Template{ID: "tpl-1", Name: "tpl", OwnerID: "owner-1", Fields: templateFields},
			},
			expectTxRun: true,
		},
		{
			name: "[Fail] sections missing",
			input: port.NoteCreateInput{
				Title:      "Hello",
				TemplateID: "tpl-1",
				OwnerID:    "owner-1",
				Sections:   nil,
			},
			tpl: &template.WithUsage{
				Template: template.Template{ID: "tpl-1", Name: "tpl", OwnerID: "owner-1", Fields: templateFields},
			},
			wantError: domainerr.ErrSectionsMissing,
		},
		{
			name: "[Fail] template get error",
			input: port.NoteCreateInput{
				Title:      "Hello",
				TemplateID: "tpl-1",
				OwnerID:    "owner-1",
				Sections:   validSections,
			},
			getTplErr: errors.New("get tpl err"),
			wantError: errors.New("get tpl err"),
		},
		{
			name: "[Fail] validation error",
			input: port.NoteCreateInput{
				Title:      "",
				TemplateID: "tpl-1",
				OwnerID:    "owner-1",
				Sections:   validSections,
			},
			tpl:       &template.WithUsage{Template: template.Template{ID: "tpl-1", Name: "tpl", OwnerID: "owner-1", Fields: templateFields}},
			wantError: domainerr.ErrTitleRequired,
		},
		{
			name: "[Fail] create error",
			input: port.NoteCreateInput{
				Title:      "Hello",
				TemplateID: "tpl-1",
				OwnerID:    "owner-1",
				Sections:   validSections,
			},
			tpl:         &template.WithUsage{Template: template.Template{ID: "tpl-1", Name: "tpl", OwnerID: "owner-1", Fields: templateFields}},
			createErr:   errors.New("create err"),
			wantError:   errors.New("create err"),
			expectTxRun: true,
		},
		{
			name: "[Fail] replace sections error",
			input: port.NoteCreateInput{
				Title:      "Hello",
				TemplateID: "tpl-1",
				OwnerID:    "owner-1",
				Sections:   validSections,
			},
			tpl:         &template.WithUsage{Template: template.Template{ID: "tpl-1", Name: "tpl", OwnerID: "owner-1", Fields: templateFields}},
			replaceErr:  errors.New("replace err"),
			wantError:   errors.New("replace err"),
			expectTxRun: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			notesRepo := mockusecase.NewMockNoteRepository(ctrl)
			tplRepo := mockusecase.NewMockTemplateRepository(ctrl)
			tx := mockusecase.NewMockTxManager(ctrl)
			out := mockusecase.NewMockNoteOutputPort(ctrl)

			tplRepo.EXPECT().Get(gomock.Any(), tt.input.TemplateID).Return(tt.tpl, tt.getTplErr)
			if tt.getTplErr == nil && tt.expectTxRun {
				tx.EXPECT().WithinTransaction(gomock.Any(), gomock.Any()).DoAndReturn(
					func(_ context.Context, fn func(context.Context) error) error {
						return fn(context.Background())
					},
				)
			}
			if tt.getTplErr == nil && tt.expectTxRun {
				notesRepo.EXPECT().Create(gomock.Any(), gomock.Any()).Return(&note.Note{ID: "note-1", TemplateID: tt.input.TemplateID, OwnerID: tt.input.OwnerID}, tt.createErr)
				if tt.createErr == nil {
					notesRepo.EXPECT().ReplaceSections(gomock.Any(), "note-1", gomock.Any()).Return(tt.replaceErr)
				}
			}
			if tt.getTplErr == nil && tt.createErr == nil && tt.replaceErr == nil && tt.wantError == nil {
				notesRepo.EXPECT().Get(gomock.Any(), "note-1").Return(&note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: tt.input.OwnerID, TemplateID: tt.input.TemplateID}}, nil)
				out.EXPECT().PresentNote(gomock.Any(), gomock.Any()).Return(nil)
			}

			interactor := uc.NewNoteInteractor(notesRepo, tplRepo, tx, out)
			err := interactor.Create(context.Background(), tt.input)

			if tt.wantError == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantError != nil && (err == nil || tt.wantError.Error() != err.Error()) {
				t.Fatalf("want %v, got %v", tt.wantError, err)
			}
		})
	}
}

func TestNoteInteractor_Update(t *testing.T) {
	templateFields := []template.Field{{ID: "f1", Label: "Title", Order: 1, IsRequired: false}}
	existingSections := []note.SectionWithField{
		{
			Section:    note.Section{ID: "sec1", FieldID: "f1", NoteID: "note-1", Content: "old"},
			FieldLabel: templateFields[0].Label,
			FieldOrder: templateFields[0].Order,
			IsRequired: templateFields[0].IsRequired,
		},
	}

	tests := []struct {
		name         string
		input        port.NoteUpdateInput
		current      *note.WithMeta
		getErr       error
		updateErr    error
		replaceErr   error
		tpl          *template.WithUsage
		wantError    error
		expectTxRun  bool
		withSections bool
	}{
		{
			name: "[Success] update title only",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   "new",
				OwnerID: "owner-1",
			},
			current: &note.WithMeta{
				Note:     note.Note{ID: "note-1", OwnerID: "owner-1", TemplateID: "tpl-1"},
				Sections: existingSections,
			},
			expectTxRun: true,
		},
		{
			name: "[Success] update sections",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   "new",
				OwnerID: "owner-1",
				Sections: []port.SectionUpdateInput{
					{SectionID: "sec1", Content: "updated"},
				},
			},
			current: &note.WithMeta{
				Note:     note.Note{ID: "note-1", OwnerID: "owner-1", TemplateID: "tpl-1"},
				Sections: existingSections,
			},
			tpl:          &template.WithUsage{Template: template.Template{ID: "tpl-1", OwnerID: "owner-1", Fields: templateFields}},
			expectTxRun:  true,
			withSections: true,
		},
		{
			name: "[Fail] owner mismatch",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   "new",
				OwnerID: "other",
			},
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1"}},
			wantError: domainerr.ErrUnauthorized,
		},
		{
			name: "[Fail] empty title",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   " ",
				OwnerID: "owner-1",
			},
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1"}},
			wantError: domainerr.ErrTitleRequired,
		},
		{
			name: "[Fail] get error",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   "new",
				OwnerID: "owner-1",
			},
			getErr:    errors.New("get err"),
			wantError: errors.New("get err"),
		},
		{
			name: "[Fail] update error",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   "new",
				OwnerID: "owner-1",
			},
			current:     &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1", TemplateID: "tpl-1"}},
			updateErr:   errors.New("update err"),
			wantError:   errors.New("update err"),
			expectTxRun: true,
		},
		{
			name: "[Fail] replace sections error",
			input: port.NoteUpdateInput{
				ID:      "note-1",
				Title:   "new",
				OwnerID: "owner-1",
				Sections: []port.SectionUpdateInput{
					{SectionID: "sec1", Content: "updated"},
				},
			},
			current: &note.WithMeta{
				Note:     note.Note{ID: "note-1", OwnerID: "owner-1", TemplateID: "tpl-1"},
				Sections: existingSections,
			},
			tpl:          &template.WithUsage{Template: template.Template{ID: "tpl-1", OwnerID: "owner-1", Fields: templateFields}},
			replaceErr:   errors.New("replace err"),
			wantError:    errors.New("replace err"),
			expectTxRun:  true,
			withSections: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			notesRepo := mockusecase.NewMockNoteRepository(ctrl)
			tplRepo := mockusecase.NewMockTemplateRepository(ctrl)
			tx := mockusecase.NewMockTxManager(ctrl)
			out := mockusecase.NewMockNoteOutputPort(ctrl)

			notesRepo.EXPECT().Get(gomock.Any(), tt.input.ID).Return(tt.current, tt.getErr)
			if tt.getErr == nil && tt.expectTxRun {
				tx.EXPECT().WithinTransaction(gomock.Any(), gomock.Any()).DoAndReturn(
					func(_ context.Context, fn func(context.Context) error) error {
						return fn(context.Background())
					},
				)
				notesRepo.EXPECT().Update(gomock.Any(), gomock.Any()).Return(&tt.current.Note, tt.updateErr)
				if tt.updateErr == nil && tt.withSections {
					tplRepo.EXPECT().Get(gomock.Any(), tt.current.Note.TemplateID).Return(tt.tpl, nil)
					notesRepo.EXPECT().ReplaceSections(gomock.Any(), tt.input.ID, gomock.Any()).Return(tt.replaceErr)
				}
			}
			if tt.getErr == nil && tt.expectTxRun && tt.updateErr == nil && (!tt.withSections || tt.replaceErr == nil) {
				notesRepo.EXPECT().Get(gomock.Any(), tt.input.ID).Return(tt.current, nil)
				out.EXPECT().PresentNote(gomock.Any(), tt.current).Return(nil)
			}

			interactor := uc.NewNoteInteractor(notesRepo, tplRepo, tx, out)
			err := interactor.Update(context.Background(), tt.input)

			if tt.wantError == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantError != nil && (err == nil || tt.wantError.Error() != err.Error()) {
				t.Fatalf("want %v, got %v", tt.wantError, err)
			}
		})
	}
}

func TestNoteInteractor_ChangeStatus(t *testing.T) {
	tests := []struct {
		name      string
		input     port.NoteStatusChangeInput
		current   *note.WithMeta
		getErr    error
		updateErr error
		wantError error
	}{
		{
			name: "[Success] publish",
			input: port.NoteStatusChangeInput{
				ID:      "note-1",
				OwnerID: "owner-1",
				Status:  note.StatusPublish,
			},
			current: &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1", Status: note.StatusDraft}},
		},
		{
			name: "[Fail] owner mismatch",
			input: port.NoteStatusChangeInput{
				ID:      "note-1",
				OwnerID: "other",
				Status:  note.StatusPublish,
			},
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1", Status: note.StatusDraft}},
			wantError: domainerr.ErrUnauthorized,
		},
		{
			name: "[Fail] invalid status",
			input: port.NoteStatusChangeInput{
				ID:      "note-1",
				OwnerID: "owner-1",
				Status:  note.NoteStatus("Invalid"),
			},
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1", Status: note.StatusDraft}},
			wantError: domainerr.ErrInvalidStatus,
		},
		{
			name: "[Fail] update status error",
			input: port.NoteStatusChangeInput{
				ID:      "note-1",
				OwnerID: "owner-1",
				Status:  note.StatusPublish,
			},
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1", Status: note.StatusDraft}},
			updateErr: errors.New("update err"),
			wantError: errors.New("update err"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			notesRepo := mockusecase.NewMockNoteRepository(ctrl)
			tplRepo := mockusecase.NewMockTemplateRepository(ctrl)
			tx := mockusecase.NewMockTxManager(ctrl)
			out := mockusecase.NewMockNoteOutputPort(ctrl)

			notesRepo.EXPECT().Get(gomock.Any(), tt.input.ID).Return(tt.current, tt.getErr)
			shouldUpdate := tt.getErr == nil && (tt.wantError == nil || (tt.updateErr != nil && tt.wantError.Error() == tt.updateErr.Error()))
			if shouldUpdate {
				notesRepo.EXPECT().UpdateStatus(gomock.Any(), tt.input.ID, tt.input.Status).Return(&tt.current.Note, tt.updateErr)
			}
			if tt.getErr == nil && tt.wantError == nil && tt.updateErr == nil {
				notesRepo.EXPECT().Get(gomock.Any(), tt.input.ID).Return(tt.current, nil)
				out.EXPECT().PresentNote(gomock.Any(), tt.current).Return(nil)
			}

			interactor := uc.NewNoteInteractor(notesRepo, tplRepo, tx, out)
			err := interactor.ChangeStatus(context.Background(), tt.input)

			if tt.wantError == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantError != nil && (err == nil || tt.wantError.Error() != err.Error()) {
				t.Fatalf("want %v, got %v", tt.wantError, err)
			}
		})
	}
}

func TestNoteInteractor_Delete(t *testing.T) {
	tests := []struct {
		name      string
		id        string
		ownerID   string
		current   *note.WithMeta
		getErr    error
		deleteErr error
		wantError error
		expectDel bool
	}{
		{
			name:      "[Success] delete",
			id:        "note-1",
			ownerID:   "owner-1",
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1"}},
			expectDel: true,
		},
		{
			name:      "[Fail] get error",
			id:        "note-1",
			ownerID:   "owner-1",
			getErr:    errors.New("get err"),
			wantError: errors.New("get err"),
		},
		{
			name:      "[Fail] owner mismatch",
			id:        "note-1",
			ownerID:   "other",
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1"}},
			wantError: domainerr.ErrUnauthorized,
		},
		{
			name:      "[Fail] delete error",
			id:        "note-1",
			ownerID:   "owner-1",
			current:   &note.WithMeta{Note: note.Note{ID: "note-1", OwnerID: "owner-1"}},
			deleteErr: errors.New("delete err"),
			wantError: errors.New("delete err"),
			expectDel: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			notesRepo := mockusecase.NewMockNoteRepository(ctrl)
			tplRepo := mockusecase.NewMockTemplateRepository(ctrl)
			tx := mockusecase.NewMockTxManager(ctrl)
			out := mockusecase.NewMockNoteOutputPort(ctrl)

			notesRepo.EXPECT().Get(gomock.Any(), tt.id).Return(tt.current, tt.getErr)
			if tt.getErr == nil && tt.expectDel {
				notesRepo.EXPECT().Delete(gomock.Any(), tt.id).Return(tt.deleteErr)
			}
			if tt.getErr == nil && tt.wantError == nil && tt.deleteErr == nil {
				out.EXPECT().PresentNoteDeleted(gomock.Any()).Return(nil)
			}

			interactor := uc.NewNoteInteractor(notesRepo, tplRepo, tx, out)
			err := interactor.Delete(context.Background(), tt.id, tt.ownerID)

			if tt.wantError == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantError != nil && (err == nil || tt.wantError.Error() != err.Error()) {
				t.Fatalf("want %v, got %v", tt.wantError, err)
			}
		})
	}
}

// b2i converts bool to int for Times() convenience.
