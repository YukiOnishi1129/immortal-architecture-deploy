// Package gorm implements gateway repositories using GORM.
package gorm

import (
	"time"
)

// Account represents the accounts table for GORM.
type Account struct {
	ID                string     `gorm:"primaryKey;column:id;type:uuid;default:gen_random_uuid()"`
	Email             string     `gorm:"column:email;uniqueIndex;not null"`
	FirstName         string     `gorm:"column:first_name;not null"`
	LastName          string     `gorm:"column:last_name;not null"`
	IsActive          bool       `gorm:"column:is_active;not null;default:true"`
	Provider          string     `gorm:"column:provider;not null"`
	ProviderAccountID string     `gorm:"column:provider_account_id;not null"`
	Thumbnail         *string    `gorm:"column:thumbnail"`
	LastLoginAt       *time.Time `gorm:"column:last_login_at"`
	CreatedAt         time.Time  `gorm:"column:created_at;not null"`
	UpdatedAt         time.Time  `gorm:"column:updated_at;not null"`
}

// TableName specifies the table name for GORM.
func (Account) TableName() string {
	return "accounts"
}
