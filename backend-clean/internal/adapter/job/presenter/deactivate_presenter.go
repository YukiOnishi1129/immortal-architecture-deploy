// Package presenter contains job presenters that implement output ports.
package presenter

import (
	"context"
	"log"

	"immortal-architecture-clean/backend/internal/port"
)

// DeactivatePresenter outputs deactivation job results.
type DeactivatePresenter struct {
	updatedCount int
}

var _ port.DeactivateJobOutputPort = (*DeactivatePresenter)(nil)

// NewDeactivatePresenter creates a new DeactivatePresenter.
func NewDeactivatePresenter() *DeactivatePresenter {
	return &DeactivatePresenter{}
}

// PresentResult logs and stores the deactivation result.
func (p *DeactivatePresenter) PresentResult(_ context.Context, updatedCount int) error {
	p.updatedCount = updatedCount
	log.Printf("deactivated %d users", updatedCount)
	return nil
}

// UpdatedCount returns the number of deactivated users.
func (p *DeactivatePresenter) UpdatedCount() int {
	return p.updatedCount
}
