// Package usecase provides application use cases.
package usecase

import (
	"context"
	"time"

	"immortal-architecture-clean/backend/internal/port"
)

const defaultInactiveDays = 90

// DeactivateInteractor handles the deactivation of inactive users.
type DeactivateInteractor struct {
	repo   port.AccountRepository
	output port.DeactivateJobOutputPort
}

var _ port.DeactivateJobInputPort = (*DeactivateInteractor)(nil)

// NewDeactivateInteractor creates a new DeactivateInteractor.
func NewDeactivateInteractor(repo port.AccountRepository, output port.DeactivateJobOutputPort) *DeactivateInteractor {
	return &DeactivateInteractor{
		repo:   repo,
		output: output,
	}
}

// Execute deactivates users who haven't logged in for more than 90 days.
func (u *DeactivateInteractor) Execute(ctx context.Context) error {
	before := time.Now().AddDate(0, 0, -defaultInactiveDays)
	count, err := u.repo.DeactivateByLastLoginBefore(ctx, before)
	if err != nil {
		return err
	}

	return u.output.PresentResult(ctx, count)
}
