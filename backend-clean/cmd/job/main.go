// Package main is the entry point for the job.
package main

import (
	"context"
	"log"
	"os"

	initializer "immortal-architecture-clean/backend/internal/driver/initializer/job"
)

func main() {
	ctx := context.Background()

	log.Println("starting job: deactivate-inactive-users")

	count, err := initializer.RunDeactivateInactiveUsers(ctx)
	if err != nil {
		log.Printf("job failed: %v", err)
		os.Exit(1)
	}

	log.Printf("job completed successfully: %d users deactivated", count)
	os.Exit(0)
}
