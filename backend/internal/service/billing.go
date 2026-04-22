package service

import (
	"errors"
	"time"

	"urban-tasks/internal/model"
)

// Plan tier constants. Matches the users.plan CHECK constraint.
const (
	PlanFree = "free"
	PlanPro  = "pro"
	PlanTeam = "team"
)

// TrialDuration is the length of the Pro trial new users get on signup.
const TrialDuration = 14 * 24 * time.Hour

// FreeProjectLimit caps how many projects a Free-tier user can own.
// Trial and paid users are unlimited.
const FreeProjectLimit = 1

// ErrProjectLimitReached is returned when a Free-tier user tries to create
// a project beyond their quota.
var ErrProjectLimitReached = errors.New("project limit reached for current plan")

// ErrProRequired is returned when a Free-tier user tries to use a
// Pro-gated feature (sending invitations, assigning tasks).
var ErrProRequired = errors.New("Pro plan required for this action")

// RequirePro returns ErrProRequired if the user's effective plan is not Pro.
func RequirePro(u *model.User, now time.Time) error {
	if EffectivePlan(u, now) != PlanPro {
		return ErrProRequired
	}
	return nil
}

// EffectivePlan returns the plan a user is currently entitled to, factoring
// in an active Pro trial. A user on the Free plan whose trial has not yet
// expired is effectively on Pro.
func EffectivePlan(u *model.User, now time.Time) string {
	if u == nil {
		return PlanFree
	}
	if u.Plan != PlanFree {
		return u.Plan
	}
	if u.TrialEndsAt != nil && u.TrialEndsAt.After(now) {
		return PlanPro
	}
	return PlanFree
}

// ProjectLimit returns the max number of projects an effective-plan tier
// can own. Zero means unlimited.
func ProjectLimit(effectivePlan string) int {
	if effectivePlan == PlanFree {
		return FreeProjectLimit
	}
	return 0
}
