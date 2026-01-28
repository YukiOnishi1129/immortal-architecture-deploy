// Package port defines application ports (interfaces).
package port

import "context"

// DeactivateJobInputPort defines the input port for user deactivation job.
type DeactivateJobInputPort interface {
	Execute(ctx context.Context) error
}

// DeactivateJobOutputPort defines the output port for user deactivation job.
type DeactivateJobOutputPort interface {
	PresentResult(ctx context.Context, updatedCount int) error
}
