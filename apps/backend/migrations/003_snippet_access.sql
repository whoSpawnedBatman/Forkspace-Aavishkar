CREATE TABLE snippet_access (
    snippet_id uuid NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (snippet_id, user_id)
);
CREATE INDEX snippet_access_user ON snippet_access (user_id, granted_at DESC);
