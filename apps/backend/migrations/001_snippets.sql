CREATE TABLE snippets (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    tags text[] NOT NULL,
    visibility text NOT NULL CHECK (visibility IN ('public', 'unlisted', 'private')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX snippets_library ON snippets (owner_id, created_at DESC, id DESC);
CREATE INDEX snippets_public ON snippets (created_at DESC, id DESC) WHERE visibility = 'public';
CREATE TABLE snippet_files (
    snippet_id uuid NOT NULL REFERENCES snippets(id),
    position integer NOT NULL CHECK (position >= 0),
    path text NOT NULL,
    content text NOT NULL,
    PRIMARY KEY (snippet_id, position),
    UNIQUE (snippet_id, path)
);
