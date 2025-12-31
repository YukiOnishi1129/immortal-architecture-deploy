// Package testutil provides testing utilities for integration and E2E tests.
package testutil

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestAccount represents test account data.
type TestAccount struct {
	ID        string
	Email     string
	FirstName string
	LastName  string
}

// TestTemplate represents test template data.
type TestTemplate struct {
	ID      string
	Name    string
	OwnerID string
	Fields  []TestField
}

// TestField represents test field data.
type TestField struct {
	ID         string
	Label      string
	Order      int
	IsRequired bool
}

// TestNote represents test note data.
type TestNote struct {
	ID         string
	Title      string
	TemplateID string
	OwnerID    string
	Status     string
	Sections   []TestSection
}

// TestSection represents test section data.
type TestSection struct {
	ID      string
	FieldID string
	Content string
}

// CreateTestAccount creates a test account in the database.
func CreateTestAccount(t *testing.T, pool *pgxpool.Pool, account TestAccount) TestAccount {
	t.Helper()
	ctx := context.Background()

	if account.ID == "" {
		account.ID = uuid.New().String()
	}
	if account.Email == "" {
		account.Email = "test-" + uuid.New().String()[:8] + "@example.com"
	}
	if account.FirstName == "" {
		account.FirstName = "Test"
	}
	if account.LastName == "" {
		account.LastName = "User"
	}

	_, err := pool.Exec(ctx, `
		INSERT INTO accounts (id, email, first_name, last_name, provider, provider_account_id)
		VALUES ($1, $2, $3, $4, 'google', $5)
	`, account.ID, account.Email, account.FirstName, account.LastName, uuid.New().String())
	if err != nil {
		t.Fatalf("failed to create test account: %v", err)
	}

	return account
}

// CreateTestTemplate creates a test template with fields in the database.
func CreateTestTemplate(t *testing.T, pool *pgxpool.Pool, template TestTemplate) TestTemplate {
	t.Helper()
	ctx := context.Background()

	if template.ID == "" {
		template.ID = uuid.New().String()
	}
	if template.Name == "" {
		template.Name = "Test Template"
	}

	_, err := pool.Exec(ctx, `
		INSERT INTO templates (id, name, owner_id)
		VALUES ($1, $2, $3)
	`, template.ID, template.Name, template.OwnerID)
	if err != nil {
		t.Fatalf("failed to create test template: %v", err)
	}

	// Create fields
	for i := range template.Fields {
		if template.Fields[i].ID == "" {
			template.Fields[i].ID = uuid.New().String()
		}
		if template.Fields[i].Order == 0 {
			template.Fields[i].Order = i + 1
		}
		if template.Fields[i].Label == "" {
			template.Fields[i].Label = "Field " + string(rune('A'+i))
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO fields (id, template_id, label, "order", is_required)
			VALUES ($1, $2, $3, $4, $5)
		`, template.Fields[i].ID, template.ID, template.Fields[i].Label, template.Fields[i].Order, template.Fields[i].IsRequired)
		if err != nil {
			t.Fatalf("failed to create test field: %v", err)
		}
	}

	return template
}

// CreateTestNote creates a test note with sections in the database.
func CreateTestNote(t *testing.T, pool *pgxpool.Pool, note TestNote) TestNote {
	t.Helper()
	ctx := context.Background()

	if note.ID == "" {
		note.ID = uuid.New().String()
	}
	if note.Title == "" {
		note.Title = "Test Note"
	}
	if note.Status == "" {
		note.Status = "Draft"
	}

	_, err := pool.Exec(ctx, `
		INSERT INTO notes (id, title, template_id, owner_id, status)
		VALUES ($1, $2, $3, $4, $5)
	`, note.ID, note.Title, note.TemplateID, note.OwnerID, note.Status)
	if err != nil {
		t.Fatalf("failed to create test note: %v", err)
	}

	// Create sections
	for i := range note.Sections {
		if note.Sections[i].ID == "" {
			note.Sections[i].ID = uuid.New().String()
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO sections (id, note_id, field_id, content)
			VALUES ($1, $2, $3, $4)
		`, note.Sections[i].ID, note.ID, note.Sections[i].FieldID, note.Sections[i].Content)
		if err != nil {
			t.Fatalf("failed to create test section: %v", err)
		}
	}

	return note
}

// DefaultTestData creates a complete set of test data and returns the IDs.
type DefaultTestData struct {
	Account  TestAccount
	Template TestTemplate
	Note     TestNote
}

// CreateDefaultTestData creates a complete set of test data.
func CreateDefaultTestData(t *testing.T, pool *pgxpool.Pool) DefaultTestData {
	t.Helper()

	// Create account
	account := CreateTestAccount(t, pool, TestAccount{
		FirstName: "Test",
		LastName:  "User",
	})

	// Create template with fields
	template := CreateTestTemplate(t, pool, TestTemplate{
		Name:    "Design Doc",
		OwnerID: account.ID,
		Fields: []TestField{
			{Label: "Background", Order: 1, IsRequired: true},
			{Label: "Solution", Order: 2, IsRequired: true},
			{Label: "Notes", Order: 3, IsRequired: false},
		},
	})

	// Create note with sections
	note := CreateTestNote(t, pool, TestNote{
		Title:      "Test Design",
		TemplateID: template.ID,
		OwnerID:    account.ID,
		Status:     "Draft",
		Sections: []TestSection{
			{FieldID: template.Fields[0].ID, Content: "Background content"},
			{FieldID: template.Fields[1].ID, Content: "Solution content"},
			{FieldID: template.Fields[2].ID, Content: ""},
		},
	})

	return DefaultTestData{
		Account:  account,
		Template: template,
		Note:     note,
	}
}
