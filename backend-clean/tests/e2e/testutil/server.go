//go:build e2e

// Package testutil provides E2E testing utilities.
package testutil

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	httpcontroller "immortal-architecture-clean/backend/internal/adapter/http/controller"
	openapi "immortal-architecture-clean/backend/internal/adapter/http/generated/openapi"
	driverdb "immortal-architecture-clean/backend/internal/driver/db"
	"immortal-architecture-clean/backend/internal/driver/factory"
	httpfactory "immortal-architecture-clean/backend/internal/driver/factory/http"
)

// TestServer wraps httptest.Server with helper methods.
type TestServer struct {
	*httptest.Server
	pool *pgxpool.Pool
}

// StartTestServer creates and starts a test server with the given database connection.
func StartTestServer(t *testing.T, connStr string) *TestServer {
	t.Helper()
	ctx := context.Background()

	// Create database pool
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}

	// Build Echo server with dependencies
	e := buildEchoServer(pool)

	// Create test server
	server := httptest.NewServer(e)

	ts := &TestServer{
		Server: server,
		pool:   pool,
	}

	t.Cleanup(func() {
		server.Close()
		pool.Close()
	})

	return ts
}

// Pool returns the database pool for test data setup.
func (s *TestServer) Pool() *pgxpool.Pool {
	return s.pool
}

// buildEchoServer builds an Echo server with all dependencies wired.
func buildEchoServer(pool *pgxpool.Pool) *echo.Echo {
	txMgr := driverdb.NewTxManager(pool)

	accountRepoFactory := factory.NewAccountRepoFactory(pool)
	templateRepoFactory := factory.NewTemplateRepoFactory(pool)
	noteRepoFactory := factory.NewNoteRepoFactory(pool)
	txFactory := factory.NewTxFactory(txMgr)

	accountOutputFactory := httpfactory.NewAccountOutputFactory()
	templateOutputFactory := httpfactory.NewTemplateOutputFactory()
	noteOutputFactory := httpfactory.NewNoteOutputFactory()

	accountInputFactory := factory.NewAccountInputFactory()
	templateInputFactory := factory.NewTemplateInputFactory()
	noteInputFactory := factory.NewNoteInputFactory()

	e := echo.New()

	ac := httpcontroller.NewAccountController(accountInputFactory, accountOutputFactory, accountRepoFactory)
	nc := httpcontroller.NewNoteController(noteInputFactory, noteOutputFactory, noteRepoFactory, templateRepoFactory, txFactory)
	tc := httpcontroller.NewTemplateController(templateInputFactory, templateOutputFactory, templateRepoFactory, txFactory)
	server := httpcontroller.NewServer(ac, nc, tc)
	openapi.RegisterHandlers(e, server)

	return e
}
