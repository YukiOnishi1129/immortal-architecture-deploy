//go:build integration

// Package sqlc implements gateway repositories using sqlc.
package sqlc

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/internal/domain/note"
	"immortal-architecture-clean/backend/tests/testutil"
)

func TestNoteRepository_Integration_CRUD(t *testing.T) {
	// Skip if running short tests
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Setup PostgreSQL container
	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)

	// Create test data
	data := testutil.CreateDefaultTestData(t, pool)

	// Create repository
	repo := NewNoteRepository(pool)
	ctx := testutil.TestContext(t)

	t.Run("Get existing note", func(t *testing.T) {
		got, err := repo.Get(ctx, data.Note.ID)
		require.NoError(t, err)
		assert.Equal(t, data.Note.Title, got.Note.Title)
		assert.Equal(t, data.Note.ID, got.Note.ID)
		assert.Equal(t, data.Template.Name, got.TemplateName)
		assert.Equal(t, data.Account.FirstName, got.OwnerFirstName)
		assert.Len(t, got.Sections, 3)
	})

	t.Run("Get non-existing note returns ErrNotFound", func(t *testing.T) {
		_, err := repo.Get(ctx, "00000000-0000-0000-0000-000000000000")
		assert.True(t, errors.Is(err, domainerr.ErrNotFound))
	})

	t.Run("Create new note", func(t *testing.T) {
		newNote := note.Note{
			Title:      "New Test Note",
			TemplateID: data.Template.ID,
			OwnerID:    data.Account.ID,
			Status:     note.StatusDraft,
		}

		created, err := repo.Create(ctx, newNote)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "New Test Note", created.Title)
		assert.Equal(t, note.StatusDraft, created.Status)

		// Verify it was actually created
		got, err := repo.Get(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, "New Test Note", got.Note.Title)
	})

	t.Run("Update note title", func(t *testing.T) {
		updateNote := note.Note{
			ID:    data.Note.ID,
			Title: "Updated Title",
		}

		updated, err := repo.Update(ctx, updateNote)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", updated.Title)

		// Verify the update
		got, err := repo.Get(ctx, data.Note.ID)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", got.Note.Title)
	})

	t.Run("Update note status to Publish", func(t *testing.T) {
		updated, err := repo.UpdateStatus(ctx, data.Note.ID, note.StatusPublish)
		require.NoError(t, err)
		assert.Equal(t, note.StatusPublish, updated.Status)

		// Verify the update
		got, err := repo.Get(ctx, data.Note.ID)
		require.NoError(t, err)
		assert.Equal(t, note.StatusPublish, got.Note.Status)
	})

	t.Run("Update note status back to Draft", func(t *testing.T) {
		updated, err := repo.UpdateStatus(ctx, data.Note.ID, note.StatusDraft)
		require.NoError(t, err)
		assert.Equal(t, note.StatusDraft, updated.Status)
	})

	t.Run("Delete note", func(t *testing.T) {
		// Create a new note to delete
		newNote := note.Note{
			Title:      "Note to Delete",
			TemplateID: data.Template.ID,
			OwnerID:    data.Account.ID,
			Status:     note.StatusDraft,
		}
		created, err := repo.Create(ctx, newNote)
		require.NoError(t, err)

		// Delete it
		err = repo.Delete(ctx, created.ID)
		require.NoError(t, err)

		// Verify it's deleted
		_, err = repo.Get(ctx, created.ID)
		assert.True(t, errors.Is(err, domainerr.ErrNotFound))
	})
}

func TestNoteRepository_Integration_List(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	data := testutil.CreateDefaultTestData(t, pool)
	repo := NewNoteRepository(pool)
	ctx := testutil.TestContext(t)

	// Create additional note with Publish status for filtering tests
	testutil.CreateTestNote(t, pool, testutil.TestNote{
		Title:      "Published Note",
		TemplateID: data.Template.ID,
		OwnerID:    data.Account.ID,
		Status:     "Publish",
	})

	t.Run("List all notes", func(t *testing.T) {
		notes, err := repo.List(ctx, note.Filters{})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(notes), 2)
	})

	t.Run("List by status Draft", func(t *testing.T) {
		status := note.StatusDraft
		notes, err := repo.List(ctx, note.Filters{Status: &status})
		require.NoError(t, err)

		for _, n := range notes {
			assert.Equal(t, note.StatusDraft, n.Note.Status)
		}
	})

	t.Run("List by status Publish", func(t *testing.T) {
		status := note.StatusPublish
		notes, err := repo.List(ctx, note.Filters{Status: &status})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(notes), 1)

		for _, n := range notes {
			assert.Equal(t, note.StatusPublish, n.Note.Status)
		}
	})

	t.Run("List by owner", func(t *testing.T) {
		notes, err := repo.List(ctx, note.Filters{OwnerID: &data.Account.ID})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(notes), 2)

		for _, n := range notes {
			assert.Equal(t, data.Account.ID, n.Note.OwnerID)
		}
	})

	t.Run("List by template", func(t *testing.T) {
		notes, err := repo.List(ctx, note.Filters{TemplateID: &data.Template.ID})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(notes), 2)

		for _, n := range notes {
			assert.Equal(t, data.Template.ID, n.Note.TemplateID)
		}
	})

	t.Run("List by query (title search)", func(t *testing.T) {
		query := "Published"
		notes, err := repo.List(ctx, note.Filters{Query: &query})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(notes), 1)
	})
}

func TestNoteRepository_Integration_Sections(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	data := testutil.CreateDefaultTestData(t, pool)
	repo := NewNoteRepository(pool)
	ctx := testutil.TestContext(t)

	t.Run("Get note with sections", func(t *testing.T) {
		got, err := repo.Get(ctx, data.Note.ID)
		require.NoError(t, err)
		assert.Len(t, got.Sections, 3)

		// Verify sections have field info
		for _, sec := range got.Sections {
			assert.NotEmpty(t, sec.Section.ID)
			assert.NotEmpty(t, sec.FieldLabel)
		}
	})

	t.Run("Replace sections - update existing", func(t *testing.T) {
		// Get current sections
		got, err := repo.Get(ctx, data.Note.ID)
		require.NoError(t, err)
		require.Len(t, got.Sections, 3)

		// Update the first section
		sections := []note.Section{
			{
				ID:      got.Sections[0].Section.ID,
				Content: "Updated content",
			},
		}

		err = repo.ReplaceSections(ctx, data.Note.ID, sections)
		require.NoError(t, err)

		// Verify the update
		updated, err := repo.Get(ctx, data.Note.ID)
		require.NoError(t, err)

		found := false
		for _, sec := range updated.Sections {
			if sec.Section.ID == got.Sections[0].Section.ID {
				assert.Equal(t, "Updated content", sec.Section.Content)
				found = true
			}
		}
		assert.True(t, found, "Updated section not found")
	})
}

func TestNoteRepository_Integration_Constraints(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	data := testutil.CreateDefaultTestData(t, pool)
	repo := NewNoteRepository(pool)
	ctx := testutil.TestContext(t)

	t.Run("Create note with invalid template ID fails", func(t *testing.T) {
		newNote := note.Note{
			Title:      "Invalid Template Note",
			TemplateID: "00000000-0000-0000-0000-000000000000", // Non-existent
			OwnerID:    data.Account.ID,
			Status:     note.StatusDraft,
		}

		_, err := repo.Create(ctx, newNote)
		assert.Error(t, err) // Foreign key violation
	})

	t.Run("Create note with invalid owner ID fails", func(t *testing.T) {
		newNote := note.Note{
			Title:      "Invalid Owner Note",
			TemplateID: data.Template.ID,
			OwnerID:    "00000000-0000-0000-0000-000000000000", // Non-existent
			Status:     note.StatusDraft,
		}

		_, err := repo.Create(ctx, newNote)
		assert.Error(t, err) // Foreign key violation
	})

	t.Run("Create note with invalid status fails", func(t *testing.T) {
		newNote := note.Note{
			Title:      "Invalid Status Note",
			TemplateID: data.Template.ID,
			OwnerID:    data.Account.ID,
			Status:     "InvalidStatus", // Invalid
		}

		_, err := repo.Create(ctx, newNote)
		assert.Error(t, err) // Check constraint violation
	})
}
