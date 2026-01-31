// Package job provides initialization for job processing.
package job

import (
	"context"
	"errors"
	"os"

	jobctrl "immortal-architecture-clean/backend/internal/adapter/job/controller"
	driverdb "immortal-architecture-clean/backend/internal/driver/db"
	"immortal-architecture-clean/backend/internal/driver/factory"
	jobfactory "immortal-architecture-clean/backend/internal/driver/factory/job"
)

// RunDeactivateInactiveUsers initializes dependencies and runs the deactivation job.
func RunDeactivateInactiveUsers(ctx context.Context) (int, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return 0, errors.New("DATABASE_URL is not set")
	}

	pool, err := driverdb.NewPool(ctx, dbURL)
	if err != nil {
		return 0, err
	}
	defer pool.Close()

	accountRepoFactory := factory.NewAccountRepoFactory(pool)
	deactivateInputFactory := factory.NewDeactivateJobInputFactory()
	deactivateOutputFactory := jobfactory.NewDeactivateOutputFactory()

	controller := jobctrl.NewDeactivateController(
		deactivateInputFactory,
		deactivateOutputFactory,
		accountRepoFactory,
	)

	return controller.Run(ctx)
}
