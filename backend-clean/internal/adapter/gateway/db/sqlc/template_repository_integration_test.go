//go:build integration

// Package sqlc implements gateway repositories using sqlc.
package sqlc

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/internal/domain/template"
	"immortal-architecture-clean/backend/tests/testutil"
)

func TestTemplateRepository_Integration_CRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)

	// Create test account
	account := testutil.CreateTestAccount(t, pool, testutil.TestAccount{
		FirstName: "Template",
		LastName:  "Owner",
	})

	repo := NewTemplateRepository(pool)
	ctx := context.Background()

	var createdID string

	t.Run("Create template", func(t *testing.T) {
		tpl := template.Template{
			Name:    "Design Document",
			OwnerID: account.ID,
		}

		created, err := repo.Create(ctx, tpl)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "Design Document", created.Name)
		assert.Equal(t, account.ID, created.OwnerID)

		createdID = created.ID
	})

	t.Run("Get template", func(t *testing.T) {
		got, err := repo.Get(ctx, createdID)
		require.NoError(t, err)
		assert.Equal(t, "Design Document", got.Template.Name)
		assert.Equal(t, account.ID, got.Template.OwnerID)
		assert.Equal(t, account.FirstName, got.Owner.FirstName)
		assert.False(t, got.IsUsed) // No notes using this template yet
	})

	t.Run("Get non-existing template returns ErrNotFound", func(t *testing.T) {
		_, err := repo.Get(ctx, "00000000-0000-0000-0000-000000000000")
		assert.True(t, errors.Is(err, domainerr.ErrNotFound))
	})

	t.Run("Update template", func(t *testing.T) {
		tpl := template.Template{
			ID:   createdID,
			Name: "Updated Design Document",
		}

		updated, err := repo.Update(ctx, tpl)
		require.NoError(t, err)
		assert.Equal(t, "Updated Design Document", updated.Name)

		// Verify the update
		got, err := repo.Get(ctx, createdID)
		require.NoError(t, err)
		assert.Equal(t, "Updated Design Document", got.Template.Name)
	})

	t.Run("Delete template", func(t *testing.T) {
		// Create a template to delete
		tpl := template.Template{
			Name:    "Template to Delete",
			OwnerID: account.ID,
		}
		created, err := repo.Create(ctx, tpl)
		require.NoError(t, err)

		// Delete it
		err = repo.Delete(ctx, created.ID)
		require.NoError(t, err)

		// Verify it's deleted
		_, err = repo.Get(ctx, created.ID)
		assert.True(t, errors.Is(err, domainerr.ErrNotFound))
	})
}

func TestTemplateRepository_Integration_Fields(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)

	account := testutil.CreateTestAccount(t, pool, testutil.TestAccount{})
	repo := NewTemplateRepository(pool)
	ctx := context.Background()

	// Create template
	tpl := template.Template{
		Name:    "Template with Fields",
		OwnerID: account.ID,
	}
	created, err := repo.Create(ctx, tpl)
	require.NoError(t, err)

	t.Run("Add fields to template", func(t *testing.T) {
		fields := []template.Field{
			{Label: "Background", Order: 1, IsRequired: true},
			{Label: "Solution", Order: 2, IsRequired: true},
			{Label: "Notes", Order: 3, IsRequired: false},
		}

		err := repo.ReplaceFields(ctx, created.ID, fields)
		require.NoError(t, err)

		// Verify fields were added
		got, err := repo.Get(ctx, created.ID)
		require.NoError(t, err)
		assert.Len(t, got.Template.Fields, 3)

		// Verify field order
		assert.Equal(t, "Background", got.Template.Fields[0].Label)
		assert.Equal(t, 1, got.Template.Fields[0].Order)
		assert.True(t, got.Template.Fields[0].IsRequired)

		assert.Equal(t, "Solution", got.Template.Fields[1].Label)
		assert.Equal(t, 2, got.Template.Fields[1].Order)

		assert.Equal(t, "Notes", got.Template.Fields[2].Label)
		assert.False(t, got.Template.Fields[2].IsRequired)
	})

	t.Run("Replace fields (update existing)", func(t *testing.T) {
		newFields := []template.Field{
			{Label: "Problem Statement", Order: 1, IsRequired: true},
			{Label: "Proposed Solution", Order: 2, IsRequired: true},
		}

		err := repo.ReplaceFields(ctx, created.ID, newFields)
		require.NoError(t, err)

		// Verify fields were replaced
		got, err := repo.Get(ctx, created.ID)
		require.NoError(t, err)
		assert.Len(t, got.Template.Fields, 2)
		assert.Equal(t, "Problem Statement", got.Template.Fields[0].Label)
		assert.Equal(t, "Proposed Solution", got.Template.Fields[1].Label)
	})
}

func TestTemplateRepository_Integration_List(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)

	// Create two accounts
	account1 := testutil.CreateTestAccount(t, pool, testutil.TestAccount{FirstName: "User1"})
	account2 := testutil.CreateTestAccount(t, pool, testutil.TestAccount{FirstName: "User2"})

	repo := NewTemplateRepository(pool)
	ctx := context.Background()

	// Create templates for account1
	tpl1, err := repo.Create(ctx, template.Template{Name: "Design Doc", OwnerID: account1.ID})
	require.NoError(t, err)
	_, err = repo.Create(ctx, template.Template{Name: "Meeting Notes", OwnerID: account1.ID})
	require.NoError(t, err)

	// Create template for account2
	_, err = repo.Create(ctx, template.Template{Name: "Project Plan", OwnerID: account2.ID})
	require.NoError(t, err)

	t.Run("List all templates", func(t *testing.T) {
		templates, err := repo.List(ctx, template.Filters{})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(templates), 3)
	})

	t.Run("List by owner", func(t *testing.T) {
		templates, err := repo.List(ctx, template.Filters{OwnerID: &account1.ID})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(templates), 2)

		for _, tpl := range templates {
			assert.Equal(t, account1.ID, tpl.Template.OwnerID)
		}
	})

	t.Run("List by query", func(t *testing.T) {
		query := "Design"
		templates, err := repo.List(ctx, template.Filters{Query: &query})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(templates), 1)
	})

	t.Run("IsUsed is true when note exists", func(t *testing.T) {
		// Create a note using tpl1
		testutil.CreateTestNote(t, pool, testutil.TestNote{
			Title:      "Note using template",
			TemplateID: tpl1.ID,
			OwnerID:    account1.ID,
		})

		// Get template and verify IsUsed
		got, err := repo.Get(ctx, tpl1.ID)
		require.NoError(t, err)
		assert.True(t, got.IsUsed)
	})
}

func TestTemplateRepository_Integration_Constraints(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)

	repo := NewTemplateRepository(pool)
	ctx := context.Background()

	t.Run("Create template with invalid owner fails", func(t *testing.T) {
		tpl := template.Template{
			Name:    "Invalid Owner Template",
			OwnerID: "00000000-0000-0000-0000-000000000000", // Non-existent
		}

		_, err := repo.Create(ctx, tpl)
		assert.Error(t, err) // Foreign key violation
	})

	t.Run("Delete template with notes fails (FK constraint)", func(t *testing.T) {
		account := testutil.CreateTestAccount(t, pool, testutil.TestAccount{})

		// Create template
		tpl, err := repo.Create(ctx, template.Template{Name: "Used Template", OwnerID: account.ID})
		require.NoError(t, err)

		// Add field
		err = repo.ReplaceFields(ctx, tpl.ID, []template.Field{{Label: "Field1", Order: 1}})
		require.NoError(t, err)

		// Get field ID
		got, err := repo.Get(ctx, tpl.ID)
		require.NoError(t, err)
		require.Len(t, got.Template.Fields, 1)

		// Create note using this template
		testutil.CreateTestNote(t, pool, testutil.TestNote{
			Title:      "Note",
			TemplateID: tpl.ID,
			OwnerID:    account.ID,
			Sections: []testutil.TestSection{
				{FieldID: got.Template.Fields[0].ID, Content: "content"},
			},
		})

		// Try to delete template - should fail due to FK constraint
		err = repo.Delete(ctx, tpl.ID)
		assert.Error(t, err)
	})
}
