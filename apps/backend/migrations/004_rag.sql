CREATE TABLE snippet_chunks (
    id bigserial PRIMARY KEY,
    snippet_id uuid NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    start_line integer NOT NULL CHECK (start_line >= 1),
    content text NOT NULL,
    search tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED
);
CREATE INDEX snippet_chunks_snippet ON snippet_chunks(snippet_id, id);
CREATE INDEX snippet_chunks_search ON snippet_chunks USING gin(search);
