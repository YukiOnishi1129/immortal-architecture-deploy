// Package testutil provides testing utilities for integration and E2E tests.
package testutil

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // postgres driver for migrate
	_ "github.com/golang-migrate/migrate/v4/source/file"       // file source for migrate
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// PostgresContainer wraps postgres container with connection string.
type PostgresContainer struct {
	*postgres.PostgresContainer
	ConnectionString string
}

// SetupPostgres starts a PostgreSQL container for testing.
// It automatically runs migrations and cleans up when the test ends.
func SetupPostgres(t *testing.T) *PostgresContainer {
	t.Helper()
	ctx := context.Background()

	// Start PostgreSQL container
	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase("test_db"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}

	// Get connection string
	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		if termErr := pgContainer.Terminate(ctx); termErr != nil {
			t.Logf("failed to terminate container: %v", termErr)
		}
		t.Fatalf("failed to get connection string: %v", err)
	}

	// Run migrations
	if err := runMigrations(connStr); err != nil {
		if termErr := pgContainer.Terminate(ctx); termErr != nil {
			t.Logf("failed to terminate container: %v", termErr)
		}
		t.Fatalf("failed to run migrations: %v", err)
	}

	// Cleanup when test ends
	t.Cleanup(func() {
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Logf("failed to terminate postgres container: %v", err)
		}
	})

	return &PostgresContainer{
		PostgresContainer: pgContainer,
		ConnectionString:  connStr,
	}
}

// NewPool creates a new pgxpool.Pool for the container.
func (c *PostgresContainer) NewPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, c.ConnectionString)
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

// runMigrations runs database migrations.
func runMigrations(connStr string) error {
	// Get the path to migrations directory
	migrationsPath, err := getMigrationsPath()
	if err != nil {
		return fmt.Errorf("failed to get migrations path: %w", err)
	}

	m, err := migrate.New(
		"file://"+migrationsPath,
		connStr,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer func() {
		_, _ = m.Close() //nolint:errcheck // Close errors are non-critical in tests
	}()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// getMigrationsPath returns the absolute path to the migrations directory.
func getMigrationsPath() (string, error) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("failed to get current file path")
	}

	// Go up from tests/testutil to backend-clean, then into migrations
	dir := filepath.Dir(filename)
	migrationsPath := filepath.Join(dir, "..", "..", "migrations")

	return filepath.Abs(migrationsPath)
}

// CleanupTables truncates all tables for test isolation.
func (c *PostgresContainer) CleanupTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	// Truncate in order respecting foreign keys
	tables := []string{"sections", "notes", "fields", "templates", "accounts"}
	for _, table := range tables {
		_, err := pool.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
		if err != nil {
			t.Fatalf("failed to truncate table %s: %v", table, err)
		}
	}
}
