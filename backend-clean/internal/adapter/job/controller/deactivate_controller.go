// Package controller contains job controllers.
package controller

import (
	"context"
	"log"

	"immortal-architecture-clean/backend/internal/adapter/job/presenter"
	"immortal-architecture-clean/backend/internal/port"
)

// DeactivateController handles user deactivation job execution.
type DeactivateController struct {
	inputFactory  func(repo port.AccountRepository, output port.DeactivateJobOutputPort) port.DeactivateJobInputPort
	outputFactory func() *presenter.DeactivatePresenter
	repoFactory   func() port.AccountRepository
}

// NewDeactivateController creates a new DeactivateController.
func NewDeactivateController(
	inputFactory func(repo port.AccountRepository, output port.DeactivateJobOutputPort) port.DeactivateJobInputPort,
	outputFactory func() *presenter.DeactivatePresenter,
	repoFactory func() port.AccountRepository,
) *DeactivateController {
	return &DeactivateController{
		inputFactory:  inputFactory,
		outputFactory: outputFactory,
		repoFactory:   repoFactory,
	}
}

// Run executes the deactivation job.
func (c *DeactivateController) Run(ctx context.Context) (int, error) {
	log.Println("starting deactivation job for users inactive > 90 days")

	p := c.outputFactory()
	repo := c.repoFactory()
	interactor := c.inputFactory(repo, p)

	if err := interactor.Execute(ctx); err != nil {
		return 0, err
	}

	return p.UpdatedCount(), nil
}
