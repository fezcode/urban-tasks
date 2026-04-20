-- Multi-user: project membership, invitations, notifications, task authorship.

CREATE TABLE project_members (
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Backfill: each existing project's owner becomes admin.
INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT id, user_id, 'admin', created_at FROM projects
ON CONFLICT DO NOTHING;

CREATE TABLE invitations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    invitee_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','expired','revoked')),
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at  TIMESTAMPTZ
);

CREATE INDEX idx_invitations_invitee_email ON invitations(LOWER(invitee_email)) WHERE status = 'pending';
CREATE INDEX idx_invitations_invitee_id    ON invitations(invitee_id) WHERE status = 'pending';
CREATE INDEX idx_invitations_project       ON invitations(project_id);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user        ON notifications(user_id, created_at DESC);

-- Task authorship: created_by and updated_by for attribution + conflict display.
ALTER TABLE tasks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE tasks SET created_by = user_id, updated_by = user_id WHERE created_by IS NULL;
