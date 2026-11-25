ALTER TABLE snippets ADD COLUMN parent_snippet_id uuid REFERENCES snippets(id);
ALTER TABLE snippets ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE snippets SET updated_at = created_at;
CREATE INDEX snippets_parent ON snippets(parent_snippet_id);
CREATE TABLE snippet_stars (
    user_id uuid NOT NULL,
    snippet_id uuid NOT NULL REFERENCES snippets(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, snippet_id)
);
CREATE INDEX snippet_stars_snippet ON snippet_stars(snippet_id);
