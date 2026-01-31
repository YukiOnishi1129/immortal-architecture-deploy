// Package job provides factories for job presenter creation.
package job

import (
	"immortal-architecture-clean/backend/internal/adapter/job/presenter"
	"immortal-architecture-clean/backend/internal/port"
)

// NewDeactivateOutputFactory returns a factory for DeactivatePresenter.
func NewDeactivateOutputFactory() func() *presenter.DeactivatePresenter {
	return func() *presenter.DeactivatePresenter {
		return presenter.NewDeactivatePresenter()
	}
}

// NewDeactivateOutputPortFactory returns a factory for DeactivateJobOutputPort.
func NewDeactivateOutputPortFactory() func() port.DeactivateJobOutputPort {
	return func() port.DeactivateJobOutputPort {
		return presenter.NewDeactivatePresenter()
	}
}
