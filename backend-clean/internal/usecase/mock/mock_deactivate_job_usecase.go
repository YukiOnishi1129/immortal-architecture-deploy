package mockusecase

import (
	"context"
	"time"

	"immortal-architecture-clean/backend/internal/domain/account"
)

// MockDeactivateJobOutputPort is a mock of port.DeactivateJobOutputPort.
type MockDeactivateJobOutputPort struct {
	UpdatedCount int
	Err          error
}

// PresentResult stores the result.
func (m *MockDeactivateJobOutputPort) PresentResult(_ context.Context, updatedCount int) error {
	m.UpdatedCount = updatedCount
	return m.Err
}

// SimpleAccountRepository is a simple mock for job testing (without gomock).
type SimpleAccountRepository struct {
	DeactivateReturn   int
	DeactivateErr      error
	DeactivateCalledAt time.Time
}

// UpsertOAuthAccount is not used in job tests.
func (m *SimpleAccountRepository) UpsertOAuthAccount(_ context.Context, _ account.OAuthAccountInput) (*account.Account, error) {
	return nil, nil
}

// GetByID is not used in job tests.
func (m *SimpleAccountRepository) GetByID(_ context.Context, _ string) (*account.Account, error) {
	return nil, nil
}

// GetByEmail is not used in job tests.
func (m *SimpleAccountRepository) GetByEmail(_ context.Context, _ string) (*account.Account, error) {
	return nil, nil
}

// DeactivateByLastLoginBefore mocks the deactivation of inactive users.
func (m *SimpleAccountRepository) DeactivateByLastLoginBefore(_ context.Context, before time.Time) (int, error) {
	m.DeactivateCalledAt = before
	return m.DeactivateReturn, m.DeactivateErr
}
