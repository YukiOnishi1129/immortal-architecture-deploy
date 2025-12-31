//go:build integration

package gorm

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"immortal-architecture-clean/backend/internal/domain/account"
	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/tests/testutil"
)

func setupGormDB(t *testing.T, connStr string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to database: %v", err)
	}
	return db
}

func TestAccountRepository_Gorm_Integration_UpsertOAuthAccount(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	db := setupGormDB(t, pg.ConnectionString)
	repo := NewAccountRepository(db)
	ctx := context.Background()

	t.Run("Create new account", func(t *testing.T) {
		input := account.OAuthAccountInput{
			Email:             "gorm-new@example.com",
			FirstName:         "Gorm",
			LastName:          "Test",
			Provider:          "google",
			ProviderAccountID: uuid.New().String(),
		}

		created, err := repo.UpsertOAuthAccount(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, created)

		assert.NotEmpty(t, created.ID)
		assert.Equal(t, input.Email, string(created.Email))
		assert.Equal(t, input.FirstName, created.FirstName)
		assert.Equal(t, input.LastName, created.LastName)
		assert.Equal(t, input.Provider, created.Provider)
	})

	t.Run("Update existing account by email", func(t *testing.T) {
		email := "gorm-update@example.com"
		providerAccountID := uuid.New().String()

		// Create initial account
		input1 := account.OAuthAccountInput{
			Email:             email,
			FirstName:         "Initial",
			LastName:          "Name",
			Provider:          "google",
			ProviderAccountID: providerAccountID,
		}
		created, err := repo.UpsertOAuthAccount(ctx, input1)
		require.NoError(t, err)
		originalID := created.ID

		// Update with same email
		input2 := account.OAuthAccountInput{
			Email:             email,
			FirstName:         "Updated",
			LastName:          "Name",
			Provider:          "google",
			ProviderAccountID: providerAccountID,
		}
		updated, err := repo.UpsertOAuthAccount(ctx, input2)
		require.NoError(t, err)

		// Should be the same account (same ID)
		assert.Equal(t, originalID, updated.ID)
		assert.Equal(t, "Updated", updated.FirstName)
	})

	t.Run("Create account with thumbnail", func(t *testing.T) {
		thumb := "https://example.com/gorm-avatar.png"
		input := account.OAuthAccountInput{
			Email:             "gorm-thumb@example.com",
			FirstName:         "With",
			LastName:          "Thumbnail",
			Provider:          "google",
			ProviderAccountID: uuid.New().String(),
			Thumbnail:         &thumb,
		}

		created, err := repo.UpsertOAuthAccount(ctx, input)
		require.NoError(t, err)
		assert.Equal(t, thumb, created.Thumbnail)
	})
}

func TestAccountRepository_Gorm_Integration_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	db := setupGormDB(t, pg.ConnectionString)
	repo := NewAccountRepository(db)
	ctx := context.Background()

	// Create test account
	input := account.OAuthAccountInput{
		Email:             "gorm-getbyid@example.com",
		FirstName:         "Get",
		LastName:          "ByID",
		Provider:          "google",
		ProviderAccountID: uuid.New().String(),
	}
	created, err := repo.UpsertOAuthAccount(ctx, input)
	require.NoError(t, err)

	t.Run("Get existing account", func(t *testing.T) {
		found, err := repo.GetByID(ctx, created.ID)
		require.NoError(t, err)
		require.NotNil(t, found)

		assert.Equal(t, created.ID, found.ID)
		assert.Equal(t, input.Email, string(found.Email))
		assert.Equal(t, input.FirstName, found.FirstName)
	})

	t.Run("Get non-existent account", func(t *testing.T) {
		_, err := repo.GetByID(ctx, uuid.New().String())
		require.Error(t, err)
		assert.ErrorIs(t, err, domainerr.ErrNotFound)
	})
}

func TestAccountRepository_Gorm_Integration_GetByEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	db := setupGormDB(t, pg.ConnectionString)
	repo := NewAccountRepository(db)
	ctx := context.Background()

	// Create test account
	email := "gorm-getbyemail@example.com"
	input := account.OAuthAccountInput{
		Email:             email,
		FirstName:         "Get",
		LastName:          "ByEmail",
		Provider:          "google",
		ProviderAccountID: uuid.New().String(),
	}
	_, err := repo.UpsertOAuthAccount(ctx, input)
	require.NoError(t, err)

	t.Run("Get existing account by email", func(t *testing.T) {
		found, err := repo.GetByEmail(ctx, email)
		require.NoError(t, err)
		require.NotNil(t, found)

		assert.Equal(t, email, string(found.Email))
		assert.Equal(t, input.FirstName, found.FirstName)
	})

	t.Run("Get non-existent email", func(t *testing.T) {
		_, err := repo.GetByEmail(ctx, "nonexistent@example.com")
		require.Error(t, err)
		assert.ErrorIs(t, err, domainerr.ErrNotFound)
	})
}
