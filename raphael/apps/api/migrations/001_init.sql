-- RAPHAËL — schéma initial (Phase 1)
-- Couvre toutes les phases prévues pour éviter des refontes ; les modules l'exploiteront
-- progressivement. Toutes les données appartiennent à un utilisateur (ON DELETE CASCADE)
-- afin que « supprimer mes données » soit réel et complet.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ─── Identité, sessions, appareils ──────────────────────────────────────────
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text NOT NULL UNIQUE,
    display_name    text NOT NULL,
    password_hash   text NOT NULL,                    -- Argon2id
    locale          text NOT NULL DEFAULT 'fr-FR',
    timezone        text NOT NULL DEFAULT 'Europe/Paris',
    preferences     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            text NOT NULL,                    -- « iPhone de … »
    platform        text NOT NULL CHECK (platform IN ('ios','ipados','android','windows','macos','linux','web')),
    push_endpoint   jsonb,                            -- abonnement Web Push
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       uuid REFERENCES devices(id) ON DELETE CASCADE,
    token_hash      bytea NOT NULL UNIQUE,            -- SHA-256 du jeton opaque ; jamais le jeton
    ip              inet,
    user_agent      text,
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE passkeys (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   bytea NOT NULL UNIQUE,
    public_key      bytea NOT NULL,
    sign_count      bigint NOT NULL DEFAULT 0,
    label           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Conversations (mémoire immédiate) ──────────────────────────────────────
CREATE TABLE conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           text,
    mode            text NOT NULL DEFAULT 'text' CHECK (mode IN ('text','voice','call')),
    summary         text,                             -- résumé glissant
    archived        boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON conversations(user_id, updated_at DESC);

CREATE TABLE messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
    content         text NOT NULL,
    modality        text NOT NULL DEFAULT 'text' CHECK (modality IN ('text','voice')),
    interrupted     boolean NOT NULL DEFAULT false,   -- réponse coupée par barge-in
    tool_calls      jsonb,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    device_id       uuid REFERENCES devices(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX messages_fts_idx ON messages USING gin (to_tsvector('simple', content));

-- ─── Mémoire à long terme et évolutive ──────────────────────────────────────
CREATE TABLE memories (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind              text NOT NULL CHECK (kind IN
                        ('fact','preference','goal','project','decision','habit','lesson','progress')),
    content           text NOT NULL,
    embedding         vector(1024),
    importance        real NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
    confidence        real NOT NULL DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
    pinned            boolean NOT NULL DEFAULT false,  -- fixé par l'utilisateur
    source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,  -- traçabilité
    superseded_by     uuid REFERENCES memories(id) ON DELETE SET NULL,  -- historique d'évolution
    access_count      integer NOT NULL DEFAULT 0,
    last_accessed_at  timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX memories_user_kind_idx ON memories(user_id, kind) WHERE superseded_by IS NULL;
CREATE INDEX memories_embedding_idx ON memories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX memories_fts_idx ON memories USING gin (to_tsvector('simple', content));

-- ─── Gestion personnelle ────────────────────────────────────────────────────
CREATE TABLE projects (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    kind            text NOT NULL DEFAULT 'project' CHECK (kind IN ('project','goal','learning')),
    status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done','dropped')),
    target_date     date,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
    title           text NOT NULL,
    notes           text,
    status          text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done','cancelled')),
    priority        smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 0 AND 3),
    due_at          timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_user_status_idx ON tasks(user_id, status, due_at);

CREATE TABLE events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz,
    location        text,
    recurrence      text,                             -- RRULE (RFC 5545)
    reminder_minutes integer[],
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX events_user_time_idx ON events(user_id, starts_at);

-- Finances : suivi uniquement. Raphaël n'exécute aucun paiement.
CREATE TABLE transactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occurred_on     date NOT NULL,
    amount_cents    bigint NOT NULL,                  -- négatif = dépense
    currency        char(3) NOT NULL DEFAULT 'EUR',
    category        text,
    label           text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_date_idx ON transactions(user_id, occurred_on DESC);

CREATE TABLE budgets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category        text NOT NULL,
    month           date NOT NULL CHECK (extract(day FROM month) = 1),
    limit_cents     bigint NOT NULL CHECK (limit_cents >= 0),
    currency        char(3) NOT NULL DEFAULT 'EUR',
    UNIQUE (user_id, category, month)
);

-- ─── Documents ──────────────────────────────────────────────────────────────
CREATE TABLE documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        text NOT NULL,
    mime_type       text NOT NULL,
    size_bytes      bigint NOT NULL,
    storage_key     text NOT NULL,                    -- emplacement chiffré
    sha256          bytea NOT NULL,
    summary         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position        integer NOT NULL,
    content         text NOT NULL,
    embedding       vector(1024),
    UNIQUE (document_id, position)
);
CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- ─── Sécurité : actions sensibles et audit ──────────────────────────────────
-- Toute action « sensible » proposée par Raphaël attend ici une confirmation explicite.
CREATE TABLE pending_actions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    tool            text NOT NULL,
    risk            text NOT NULL CHECK (risk IN ('write','sensitive')),
    arguments       jsonb NOT NULL,
    explanation     text NOT NULL,                    -- ce que Raphaël va faire, en clair
    status          text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','expired','executed','failed')),
    decided_at      timestamptz,
    decided_by_device uuid REFERENCES devices(id) ON DELETE SET NULL,
    result          jsonb,
    expires_at      timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_actions_user_idx ON pending_actions(user_id) WHERE status = 'pending';

CREATE TABLE audit_log (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    actor           text NOT NULL CHECK (actor IN ('user','raphael','system')),
    action          text NOT NULL,
    target          text,
    details         jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip              inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_user_idx ON audit_log(user_id, created_at DESC);

-- ─── Mise à jour automatique de updated_at ──────────────────────────────────
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','conversations','memories','projects','tasks'] LOOP
    EXECUTE format('CREATE TRIGGER %I_touch BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t, t);
  END LOOP;
END $$;
