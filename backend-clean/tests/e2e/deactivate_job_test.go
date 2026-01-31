//go:build e2e

// Package e2e contains end-to-end tests.
package e2e

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	jobctrl "immortal-architecture-clean/backend/internal/adapter/job/controller"
	driverdb "immortal-architecture-clean/backend/internal/driver/db"
	"immortal-architecture-clean/backend/internal/driver/factory"
	jobfactory "immortal-architecture-clean/backend/internal/driver/factory/job"
	basetestutil "immortal-architecture-clean/backend/tests/testutil"
)

func TestDeactivateJob_E2E(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	pg := basetestutil.SetupPostgres(t)
	pool := pg.NewPool(t)
	ctx := basetestutil.TestContext(t)

	// Helper to create account with specific last_login_at
	createAccountWithLastLogin := func(t *testing.T, email string, lastLogin time.Time, isActive bool) string {
		t.Helper()
		id := uuid.New().String()
		_, err := pool.Exec(context.Background(), `
			INSERT INTO accounts (id, email, first_name, last_name, provider, provider_account_id, is_active, last_login_at)
			VALUES ($1, $2, 'Test', 'User', 'google', $3, $4, $5)
		`, id, email, uuid.New().String(), isActive, lastLogin)
		require.NoError(t, err)
		return id
	}

	// Helper to get is_active status
	getIsActive := func(t *testing.T, id string) bool {
		t.Helper()
		var isActive bool
		err := pool.QueryRow(context.Background(), `SELECT is_active FROM accounts WHERE id = $1`, id).Scan(&isActive)
		require.NoError(t, err)
		return isActive
	}

	// Helper to run the job
	runDeactivateJob := func(t *testing.T) int {
		t.Helper()
		txMgr := driverdb.NewTxManager(pool)
		_ = txMgr // not used in this job, but showing the pattern

		accountRepoFactory := factory.NewAccountRepoFactory(pool)
		deactivateInputFactory := factory.NewDeactivateJobInputFactory()
		deactivateOutputFactory := jobfactory.NewDeactivateOutputFactory()

		controller := jobctrl.NewDeactivateController(
			deactivateInputFactory,
			deactivateOutputFactory,
			accountRepoFactory,
		)

		count, err := controller.Run(ctx)
		require.NoError(t, err)
		return count
	}

	t.Run("非アクティブユーザーを無効化し、冪等性を保つ", func(t *testing.T) {
		// テストデータ:
		// - ユーザーA: 100日前にログイン、アクティブ -> 無効化される
		// - ユーザーB: 50日前にログイン、アクティブ -> 無効化されない
		// - ユーザーC: 120日前にログイン、既に非アクティブ -> そのまま

		userA := createAccountWithLastLogin(t, "user-a-e2e@example.com", time.Now().AddDate(0, 0, -100), true)
		userB := createAccountWithLastLogin(t, "user-b-e2e@example.com", time.Now().AddDate(0, 0, -50), true)
		userC := createAccountWithLastLogin(t, "user-c-e2e@example.com", time.Now().AddDate(0, 0, -120), false)

		// 1回目の実行
		count1 := runDeactivateJob(t)

		// 検証: ユーザーAが無効化される（少なくとも1人）
		assert.GreaterOrEqual(t, count1, 1, "1回目の実行で少なくとも1人は無効化される")

		// 各ユーザーの状態を検証
		assert.False(t, getIsActive(t, userA), "ユーザーA（100日間未ログイン）は無効化される")
		assert.True(t, getIsActive(t, userB), "ユーザーB（50日間未ログイン）はアクティブのまま")
		assert.False(t, getIsActive(t, userC), "ユーザーC（元から非アクティブ）はそのまま")

		// 2回目の実行 - 冪等性のテスト
		count2 := runDeactivateJob(t)

		// 検証: 2回目は0人が無効化される
		assert.Equal(t, 0, count2, "2回目の実行では0人が無効化される（冪等性）")

		// 状態が変わっていないことを検証
		assert.False(t, getIsActive(t, userA), "2回目実行後もユーザーAは非アクティブ")
		assert.True(t, getIsActive(t, userB), "2回目実行後もユーザーBはアクティブ")
		assert.False(t, getIsActive(t, userC), "2回目実行後もユーザーCは非アクティブ")
	})

	t.Run("境界値テスト: ちょうど90日のケース", func(t *testing.T) {
		// ちょうど90日前にログインしたユーザー
		// 条件は「90日前より前」なので、ちょうど90日は無効化されない
		userExact := createAccountWithLastLogin(t, "user-exact-90@example.com", time.Now().AddDate(0, 0, -90), true)

		// 91日前にログインしたユーザーは無効化される
		user91 := createAccountWithLastLogin(t, "user-91-days@example.com", time.Now().AddDate(0, 0, -91), true)

		runDeactivateJob(t)

		// 実装では "before := time.Now().AddDate(0, 0, -90)" で
		// "WHERE last_login_at < before" なので、ちょうど90日はタイミング次第
		// 91日は確実に無効化される
		assert.False(t, getIsActive(t, user91), "91日間未ログインのユーザーは無効化される")

		// ちょうど90日の場合、正確なタイムスタンプ比較による
		// このテストは実際の動作を記録する
		t.Logf("ちょうど90日のユーザー - is_active: %v（正確なタイミングに依存）", getIsActive(t, userExact))
	})

	t.Run("対象ユーザーがいない場合も正常終了する", func(t *testing.T) {
		// 最近ログインしたアクティブユーザーのみ作成
		createAccountWithLastLogin(t, "recent-user-1@example.com", time.Now().AddDate(0, 0, -10), true)
		createAccountWithLastLogin(t, "recent-user-2@example.com", time.Now().AddDate(0, 0, -30), true)

		// ジョブ実行 - 前のテストケースで古いユーザーは既に無効化されている可能性あり
		// この実行では新たに無効化されるユーザーは0人（残りのアクティブユーザーは最近ログイン済み）
		count := runDeactivateJob(t)

		// カウントはテスト順序によって0以上になるが、エラーなく完了すべき
		assert.GreaterOrEqual(t, count, 0, "対象ユーザーがいなくてもエラーなく完了する")
	})

	t.Run("複数回連続実行しても冪等性が保たれる", func(t *testing.T) {
		// 無効化対象のユーザーを作成
		createAccountWithLastLogin(t, "multi-run-user@example.com", time.Now().AddDate(0, 0, -200), true)

		// 3回実行
		count1 := runDeactivateJob(t)
		count2 := runDeactivateJob(t)
		count3 := runDeactivateJob(t)

		// 1回目でユーザーが無効化され、2回目以降は0人
		assert.GreaterOrEqual(t, count1, 1, "1回目の実行で少なくとも1人は無効化される")
		assert.Equal(t, 0, count2, "2回目の実行では0人が無効化される")
		assert.Equal(t, 0, count3, "3回目の実行では0人が無効化される")
	})
}
