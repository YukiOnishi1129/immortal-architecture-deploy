//go:build integration

// Package sqlc implements gateway repositories using sqlc.
package sqlc

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"immortal-architecture-clean/backend/internal/domain/account"
	domainerr "immortal-architecture-clean/backend/internal/domain/errors"
	"immortal-architecture-clean/backend/tests/testutil"
)

func TestAccountRepository_Integration_UpsertOAuthAccount(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	repo := NewAccountRepository(pool)
	ctx := testutil.TestContext(t)

	t.Run("Create new account", func(t *testing.T) {
		input := account.OAuthAccountInput{
			Email:             "new-user@example.com",
			FirstName:         "New",
			LastName:          "User",
			Provider:          "google",
			ProviderAccountID: uuid.New().String(),
			Thumbnail:         nil,
		}

		created, err := repo.UpsertOAuthAccount(ctx, input)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "new-user@example.com", created.Email.String())
		assert.Equal(t, "New", created.FirstName)
		assert.Equal(t, "User", created.LastName)
		assert.Equal(t, "google", created.Provider)
		assert.True(t, created.IsActive)
	})

	t.Run("Upsert existing account updates info", func(t *testing.T) {
		providerID := uuid.New().String()
		input := account.OAuthAccountInput{
			Email:             "upsert-test@example.com",
			FirstName:         "Original",
			LastName:          "Name",
			Provider:          "google",
			ProviderAccountID: providerID,
		}

		// First insert
		first, err := repo.UpsertOAuthAccount(ctx, input)
		require.NoError(t, err)

		// Update with new info
		input.FirstName = "Updated"
		input.LastName = "Person"

		second, err := repo.UpsertOAuthAccount(ctx, input)
		require.NoError(t, err)

		// Should be same account
		assert.Equal(t, first.ID, second.ID)
		assert.Equal(t, "Updated", second.FirstName)
		assert.Equal(t, "Person", second.LastName)
	})

	t.Run("Create account with thumbnail", func(t *testing.T) {
		thumb := "https://example.com/avatar.jpg"
		input := account.OAuthAccountInput{
			Email:             "with-thumb@example.com",
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

func TestAccountRepository_Integration_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	repo := NewAccountRepository(pool)
	ctx := testutil.TestContext(t)

	// Create test account
	testAcc := testutil.CreateTestAccount(t, pool, testutil.TestAccount{
		Email:     "get-by-id@example.com",
		FirstName: "GetBy",
		LastName:  "ID",
	})

	t.Run("Get existing account", func(t *testing.T) {
		got, err := repo.GetByID(ctx, testAcc.ID)
		require.NoError(t, err)
		assert.Equal(t, testAcc.ID, got.ID)
		assert.Equal(t, "get-by-id@example.com", got.Email.String())
		assert.Equal(t, "GetBy", got.FirstName)
		assert.Equal(t, "ID", got.LastName)
	})

	t.Run("Get non-existing account returns error", func(t *testing.T) {
		_, err := repo.GetByID(ctx, "00000000-0000-0000-0000-000000000000")
		assert.Error(t, err)
	})

	t.Run("Get with invalid UUID returns error", func(t *testing.T) {
		_, err := repo.GetByID(ctx, "invalid-uuid")
		assert.Error(t, err)
	})
}

func TestAccountRepository_Integration_GetByEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	repo := NewAccountRepository(pool)
	ctx := testutil.TestContext(t)

	// Create test account
	testAcc := testutil.CreateTestAccount(t, pool, testutil.TestAccount{
		Email:     "get-by-email@example.com",
		FirstName: "GetBy",
		LastName:  "Email",
	})

	t.Run("Get existing account by email", func(t *testing.T) {
		got, err := repo.GetByEmail(ctx, testAcc.Email)
		require.NoError(t, err)
		assert.Equal(t, testAcc.ID, got.ID)
		assert.Equal(t, "get-by-email@example.com", got.Email.String())
	})

	t.Run("Get non-existing email returns ErrNotFound", func(t *testing.T) {
		_, err := repo.GetByEmail(ctx, "not-exist@example.com")
		assert.True(t, errors.Is(err, domainerr.ErrNotFound))
	})
}

func TestAccountRepository_Integration_Constraints(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	repo := NewAccountRepository(pool)
	ctx := testutil.TestContext(t)

	t.Run("Email uniqueness constraint", func(t *testing.T) {
		email := "unique-test@example.com"

		// Create first account
		input1 := account.OAuthAccountInput{
			Email:             email,
			FirstName:         "First",
			LastName:          "User",
			Provider:          "google",
			ProviderAccountID: uuid.New().String(),
		}
		_, err := repo.UpsertOAuthAccount(ctx, input1)
		require.NoError(t, err)

		// Try to create another account with same email but different provider
		// UPSERT is on (provider, provider_account_id), not email
		// So this should fail with email uniqueness constraint
		input2 := account.OAuthAccountInput{
			Email:             email,
			FirstName:         "Second",
			LastName:          "User",
			Provider:          "github", // Different provider
			ProviderAccountID: uuid.New().String(),
		}
		_, err = repo.UpsertOAuthAccount(ctx, input2)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "duplicate key value violates unique constraint")
	})

	t.Run("Provider account uniqueness", func(t *testing.T) {
		providerID := uuid.New().String()

		// Create first account
		input1 := account.OAuthAccountInput{
			Email:             "provider1@example.com",
			FirstName:         "First",
			LastName:          "User",
			Provider:          "google",
			ProviderAccountID: providerID,
		}
		first, err := repo.UpsertOAuthAccount(ctx, input1)
		require.NoError(t, err)

		// Create with same provider + providerAccountID but different email
		// This should update due to UPSERT on provider + provider_account_id
		input2 := account.OAuthAccountInput{
			Email:             "provider2@example.com",
			FirstName:         "Updated",
			LastName:          "Name",
			Provider:          "google",
			ProviderAccountID: providerID, // Same as first
		}
		second, err := repo.UpsertOAuthAccount(ctx, input2)
		require.NoError(t, err)

		// Should be same account, updated
		assert.Equal(t, first.ID, second.ID)
		assert.Equal(t, "Updated", second.FirstName)
	})
}

func TestAccountRepository_Integration_DeactivateByLastLoginBefore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pg := testutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	repo := NewAccountRepository(pool)
	ctx := testutil.TestContext(t)

	// Helper to create account with specific last_login_at
	createAccountWithLastLogin := func(t *testing.T, email string, lastLogin time.Time, isActive bool) string {
		t.Helper()
		id := uuid.New().String()
		_, err := pool.Exec(context.Background(), `
			INSERT INTO accounts (id, email, first_name, last_name, provider, provider_account_id, is_active, last_login_at)
			VALUES ($1, $2, 'Test', 'User', 'google', $3, $4, $5)
		`, id, email, uuid.New().String(), isActive, lastLogin)
		require.NoError(t, err)
		return id
	}

	// Helper to get is_active status
	getIsActive := func(t *testing.T, id string) bool {
		t.Helper()
		var isActive bool
		err := pool.QueryRow(context.Background(), `SELECT is_active FROM accounts WHERE id = $1`, id).Scan(&isActive)
		require.NoError(t, err)
		return isActive
	}

	t.Run("Deactivates users inactive for more than threshold", func(t *testing.T) {
		// Create user who logged in 100 days ago (should be deactivated)
		oldLogin := time.Now().AddDate(0, 0, -100)
		oldUserID := createAccountWithLastLogin(t, "old-user-1@example.com", oldLogin, true)

		// Create user who logged in 50 days ago (should NOT be deactivated)
		recentLogin := time.Now().AddDate(0, 0, -50)
		recentUserID := createAccountWithLastLogin(t, "recent-user-1@example.com", recentLogin, true)

		// Deactivate users who haven't logged in for 90 days
		threshold := time.Now().AddDate(0, 0, -90)
		count, err := repo.DeactivateByLastLoginBefore(ctx, threshold)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, count, 1)

		// Verify old user is deactivated
		assert.False(t, getIsActive(t, oldUserID))

		// Verify recent user is still active
		assert.True(t, getIsActive(t, recentUserID))
	})

	t.Run("Idempotency - second run returns 0", func(t *testing.T) {
		// Create user who logged in 120 days ago
		oldLogin := time.Now().AddDate(0, 0, -120)
		createAccountWithLastLogin(t, "idempotent-user@example.com", oldLogin, true)

		threshold := time.Now().AddDate(0, 0, -90)

		// First deactivation
		count1, err := repo.DeactivateByLastLoginBefore(ctx, threshold)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, count1, 1)

		// Second deactivation - should return 0 (already deactivated)
		count2, err := repo.DeactivateByLastLoginBefore(ctx, threshold)
		require.NoError(t, err)
		assert.Equal(t, 0, count2)
	})

	t.Run("Does not affect already inactive users", func(t *testing.T) {
		// Create already inactive user who logged in 150 days ago
		oldLogin := time.Now().AddDate(0, 0, -150)
		inactiveUserID := createAccountWithLastLogin(t, "already-inactive@example.com", oldLogin, false)

		threshold := time.Now().AddDate(0, 0, -90)
		_, err := repo.DeactivateByLastLoginBefore(ctx, threshold)
		require.NoError(t, err)

		// User should still be inactive (no change)
		assert.False(t, getIsActive(t, inactiveUserID))
	})

	t.Run("Returns 0 when no users to deactivate", func(t *testing.T) {
		// Use a threshold far in the past
		threshold := time.Now().AddDate(-10, 0, 0) // 10 years ago
		count, err := repo.DeactivateByLastLoginBefore(ctx, threshold)
		require.NoError(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("Deactivates multiple users at once", func(t *testing.T) {
		// Create 3 users who all logged in 200 days ago
		oldLogin := time.Now().AddDate(0, 0, -200)
		id1 := createAccountWithLastLogin(t, "batch-1@example.com", oldLogin, true)
		id2 := createAccountWithLastLogin(t, "batch-2@example.com", oldLogin, true)
		id3 := createAccountWithLastLogin(t, "batch-3@example.com", oldLogin, true)

		threshold := time.Now().AddDate(0, 0, -90)
		count, err := repo.DeactivateByLastLoginBefore(ctx, threshold)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, count, 3)

		// All should be deactivated
		assert.False(t, getIsActive(t, id1))
		assert.False(t, getIsActive(t, id2))
		assert.False(t, getIsActive(t, id3))
	})
}
