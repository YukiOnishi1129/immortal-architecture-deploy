package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"immortal-architecture-clean/backend/internal/usecase"
	mockusecase "immortal-architecture-clean/backend/internal/usecase/mock"
)

func TestDeactivateInteractor_Execute(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		mockReturn   int
		mockErr      error
		presenterErr error
		wantCount    int
		wantErr      bool
	}{
		{
			name:       "正常系: 10件更新",
			mockReturn: 10,
			mockErr:    nil,
			wantCount:  10,
			wantErr:    false,
		},
		{
			name:       "正常系: 0件更新（対象なし）",
			mockReturn: 0,
			mockErr:    nil,
			wantCount:  0,
			wantErr:    false,
		},
		{
			name:       "正常系: 大量更新（1000件）",
			mockReturn: 1000,
			mockErr:    nil,
			wantCount:  1000,
			wantErr:    false,
		},
		{
			name:       "異常系: DBエラー",
			mockReturn: 0,
			mockErr:    errors.New("db connection error"),
			wantCount:  0,
			wantErr:    true,
		},
		{
			name:         "異常系: Presenterエラー",
			mockReturn:   5,
			mockErr:      nil,
			presenterErr: errors.New("presenter error"),
			wantCount:    0,
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockRepo := &mockusecase.SimpleAccountRepository{
				DeactivateReturn: tt.mockReturn,
				DeactivateErr:    tt.mockErr,
			}
			mockOutput := &mockusecase.MockDeactivateJobOutputPort{
				Err: tt.presenterErr,
			}

			interactor := usecase.NewDeactivateInteractor(mockRepo, mockOutput)
			err := interactor.Execute(context.Background())

			// エラーの検証
			if tt.wantErr {
				require.Error(t, err)
				return
			}

			// 正常系の検証
			require.NoError(t, err)
			assert.Equal(t, tt.wantCount, mockOutput.UpdatedCount)

			// 90日前の日時で呼び出されたか検証（1秒の誤差を許容）
			expectedBefore := time.Now().AddDate(0, 0, -90)
			assert.WithinDuration(t, expectedBefore, mockRepo.DeactivateCalledAt, time.Second)
		})
	}
}
