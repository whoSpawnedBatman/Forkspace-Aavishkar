import type { ForkParentRef, SnippetFile, SnippetRevision, Visibility } from '../domain';

export interface StoredSnippetRecord {
  id: string;
  title: string;
  description?: string;
  visibility: Visibility;
  tags: string[];
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  forkedFrom?: ForkParentRef;
  forkOriginFiles?: SnippetFile[];
  history?: SnippetRevision[];
  starredBy: string[];
  files: SnippetFile[];
  createdAt: string;
  updatedAt: string;
}

export const LANDING_PREVIEW_SNIPPET_ID = 'three-file-web-demo';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export function createSeedRecords(): StoredSnippetRecord[] {
  const webDemoV1Files: SnippetFile[] = [
    {
      path: 'index.html',
      language: 'html',
      text: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Three-file web demo</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="./app.js"></script>
  </body>
</html>`,
    },
    {
      path: 'app.js',
      language: 'javascript',
      text: `const root = document.getElementById('app');

export function renderStatus(label, count) {
  if (!root) return;
  root.textContent = \`\${label}: \${count} active files\`;
}

renderStatus('Snipbase bundle ready', 3);`,
    },
    {
      path: 'styles.css',
      language: 'css',
      text: `:root {
  color-scheme: dark;
  --surface: #111114;
  --accent: #7c6af0;
}

body {
  margin: 0;
  padding: 2rem;
  font-family: system-ui, sans-serif;
  background: var(--surface);
  color: #efeff4;
}`,
    },
  ];

  const webDemoFork1Files: SnippetFile[] = [
    {
      path: 'index.html',
      language: 'html',
      text: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Three-file web demo — Interactive Fork</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main id="app" data-theme="obsidian"></main>
    <button id="increment-btn" type="button">Add file</button>
    <script type="module" src="./app.js"></script>
  </body>
</html>`,
    },
    {
      path: 'app.js',
      language: 'javascript',
      text: `import { createCounter } from './counter.js';

const root = document.getElementById('app');
const button = document.getElementById('increment-btn');
const counter = createCounter(3);

export function renderStatus(label, count) {
  if (!root) return;
  root.textContent = \`\${label}: \${count} active files\`;
}

renderStatus('Snipbase interactive fork', counter.value());

button?.addEventListener('click', () => {
  renderStatus('Snipbase interactive fork', counter.next());
});`,
    },
    {
      path: 'styles.css',
      language: 'css',
      text: `:root {
  color-scheme: dark;
  --surface: #111114;
  --accent: #7c6af0;
  --accent-hover: #8d7df8;
}

body {
  margin: 0;
  padding: 2rem;
  font-family: system-ui, sans-serif;
  background: var(--surface);
  color: #efeff4;
}

#increment-btn {
  margin-top: 1rem;
  padding: 0.5rem 0.9rem;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: #ffffff;
  cursor: pointer;
}`,
    },
    {
      path: 'counter.js',
      language: 'javascript',
      text: `export function createCounter(initial = 0) {
  let current = initial;
  return {
    value: () => current,
    next: () => {
      current += 1;
      return current;
    },
  };
}`,
    },
  ];

  const webDemoFork2Files: SnippetFile[] = [
    ...webDemoFork1Files.slice(0, 1),
    {
      path: 'app.js',
      language: 'javascript',
      text: `import { createCounter } from './counter.js';

const root = document.getElementById('app');
const button = document.getElementById('increment-btn');
const counter = createCounter(3);

export function renderStatus(label, count) {
  if (!root) return;
  const plural = count === 1 ? 'file' : 'files';
  root.textContent = \`\${label}: \${count} active \${plural}\`;
}

renderStatus('Snipbase nested fork (v2)', counter.value());

button?.addEventListener('click', () => {
  const nextCount = counter.next();
  renderStatus('Snipbase nested fork (v2)', nextCount);
  document.title = \`Snipbase (\${nextCount})\`;
});`,
    },
    webDemoFork1Files[2],
    webDemoFork1Files[3],
  ];

  const ragOriginalFiles: SnippetFile[] = [
    {
      path: 'main.py',
      language: 'python',
      text: `from fastapi import FastAPI
from routers.query import router as query_router

app = FastAPI(title="Snipbase RAG Service", version="1.0.0")
app.include_router(query_router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}`,
    },
    {
      path: 'routers/query.py',
      language: 'python',
      text: `from fastapi import APIRouter
from pydantic import BaseModel
from utils.embed import cosine_rank

router = APIRouter(tags=["retrieval"])


class QueryRequest(BaseModel):
    prompt: str
    top_k: int = 5


@router.post("/search")
async def search_documents(payload: QueryRequest) -> dict[str, object]:
    matches = cosine_rank(payload.prompt, limit=payload.top_k)
    return {"query": payload.prompt, "matches": matches}`,
    },
    {
      path: 'utils/embed.py',
      language: 'python',
      text: `def cosine_rank(query: str, limit: int = 5) -> list[dict[str, object]]:
    tokens = {word.lower() for word in query.split() if len(word) > 2}
    return [
        {"id": f"doc-{idx}", "score": round(1.0 - idx * 0.08, 3), "terms": sorted(tokens)}
        for idx in range(min(limit, 3))
    ]`,
    },
  ];

  const ragForkFiles: SnippetFile[] = [
    ragOriginalFiles[0],
    {
      path: 'routers/query.py',
      language: 'python',
      text: `from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from utils.embed import hybrid_rank

router = APIRouter(tags=["retrieval"])


class QueryRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=500)
    top_k: int = Field(default=5, ge=1, le=20)
    alpha: float = Field(default=0.7, ge=0.0, le=1.0)


@router.post("/search")
async def search_documents(payload: QueryRequest) -> dict[str, object]:
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Query prompt cannot be blank")
    matches = hybrid_rank(payload.prompt, limit=payload.top_k, alpha=payload.alpha)
    return {"query": payload.prompt, "mode": "hybrid", "matches": matches}`,
    },
    {
      path: 'utils/embed.py',
      language: 'python',
      text: `def cosine_rank(query: str, limit: int = 5) -> list[dict[str, object]]:
    tokens = {word.lower() for word in query.split() if len(word) > 2}
    return [
        {"id": f"doc-{idx}", "score": round(1.0 - idx * 0.08, 3), "terms": sorted(tokens)}
        for idx in range(min(limit, 3))
    ]


def hybrid_rank(query: str, limit: int = 5, alpha: float = 0.7) -> list[dict[str, object]]:
    semantic = cosine_rank(query, limit=limit)
    for item in semantic:
        lexical_boost = min(len(item["terms"]) * 0.03, 0.15)
        item["score"] = round(alpha * item["score"] + (1 - alpha) * lexical_boost, 3)
    return sorted(semantic, key=lambda row: row["score"], reverse=True)`,
    },
  ];

  const dockerFiles: SnippetFile[] = [
    {
      path: 'Dockerfile',
      language: 'dockerfile',
      text: `FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "dist/server.js"]`,
    },
    {
      path: 'docker-compose.yml',
      language: 'yaml',
      text: `services:
  proxy:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
    restart: unless-stopped

  api:
    build: .
    env_file:
      - .env
    expose:
      - "3000"`,
    },
    {
      path: 'nginx.conf',
      language: 'nginx',
      text: `server {
  listen 80;
  server_name _;

  add_header X-Content-Type-Options "nosniff" always;

  location /raw/ {
    proxy_pass http://api:3000;
    proxy_hide_header Content-Type;
    add_header Content-Type "text/plain; charset=utf-8" always;
    add_header X-Content-Type-Options "nosniff" always;
  }
}`,
    },
  ];

  const llmCacheFiles: SnippetFile[] = [
    {
      path: 'cache.py',
      language: 'python',
      text: `import hashlib
import json
from typing import Any
from redis_client import get_redis


def build_cache_key(model: str, prompt: str) -> str:
    digest = hashlib.sha256(f"{model}:{prompt.strip()}".encode("utf-8")).hexdigest()
    return f"llm:resp:{digest[:24]}"


def get_or_compute(model: str, prompt: str, compute_fn, ttl_seconds: int = 3600) -> dict[str, Any]:
    client = get_redis()
    key = build_cache_key(model, prompt)
    cached = client.get(key)
    if cached:
        return json.loads(cached)

    fresh = compute_fn(prompt)
    client.setex(key, ttl_seconds, json.dumps(fresh))
    return fresh`,
    },
    {
      path: 'redis_client.py',
      language: 'python',
      text: `import os
import redis

_pool = None


def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        _pool = redis.ConnectionPool.from_url(url, decode_responses=True)
    return redis.Redis(connection_pool=_pool)`,
    },
  ];

  const rateLimitFiles: SnippetFile[] = [
    {
      path: 'src/limiter.ts',
      language: 'typescript',
      text: `export interface WindowBucket {
  hits: number;
  resetAt: number;
}

export function createRateLimiter(limit: number, windowMs: number) {
  const store = new Map<string, WindowBucket>();

  return function allowRequest(key: string, now = Date.now()): boolean {
    const entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      store.set(key, { hits: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.hits >= limit) {
      return false;
    }
    entry.hits += 1;
    return true;
  };
}`,
    },
    {
      path: 'src/limiter.test.ts',
      language: 'typescript',
      text: `import { createRateLimiter } from './limiter';

const allow = createRateLimiter(2, 1000);
console.assert(allow('client-a', 100) === true, 'first request passes');
console.assert(allow('client-a', 200) === true, 'second request passes');
console.assert(allow('client-a', 300) === false, 'third request blocked');`,
    },
  ];

  return [
    {
      id: 'three-file-web-demo',
      title: 'Three-file web demo',
      description:
        'Minimal three-file HTML, JS, and CSS starter demonstrating multi-file tabs, syntax highlighting, and clean embedding.',
      visibility: 'unlisted',
      tags: ['demo', 'javascript'],
      ownerId: 'user-rishi',
      ownerName: 'Rishi Jayaram',
      ownerHandle: '@rishi',
      starredBy: ['user-rishi'],
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(4),
      files: webDemoV1Files,
      history: [
        {
          id: 'rev-web-2',
          type: 'edited',
          summary: 'Refined dark palette tokens in styles.css and status text in app.js',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(4),
          addedLines: 4,
          removedLines: 2,
          filesChanged: ['app.js', 'styles.css'],
          snapshotFiles: webDemoV1Files,
        },
        {
          id: 'rev-web-1',
          type: 'created',
          summary: 'Created snippet with 3 files',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(6),
          addedLines: 32,
          removedLines: 0,
          filesChanged: ['index.html', 'app.js', 'styles.css'],
          snapshotFiles: [
            webDemoV1Files[0],
            {
              path: 'app.js',
              language: 'javascript',
              text: `const root = document.getElementById('app');

export function renderStatus(label, count) {
  if (!root) return;
  root.textContent = \`\${label}: \${count} files\`;
}

renderStatus('Snipbase ready', 3);`,
            },
            {
              path: 'styles.css',
              language: 'css',
              text: `:root {
  color-scheme: dark;
  --surface: #111114;
}

body {
  margin: 0;
  padding: 2rem;
  font-family: system-ui, sans-serif;
  background: var(--surface);
  color: #ffffff;
}`,
            },
          ],
        },
      ],
    },
    {
      id: 'three-file-web-demo-interactive',
      title: 'Three-file web demo (Interactive counter)',
      description:
        'Forked from Three-file web demo to add an interactive counter module and iris CTA button.',
      visibility: 'public',
      tags: ['demo', 'javascript', 'fork'],
      ownerId: 'user-ananya',
      ownerName: 'Ananya K',
      ownerHandle: '@ananya',
      forkedFrom: {
        id: 'three-file-web-demo',
        title: 'Three-file web demo',
        ownerName: 'Rishi Jayaram',
      },
      forkOriginFiles: webDemoV1Files,
      starredBy: ['user-rishi', 'user-ananya'],
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(2),
      files: webDemoFork1Files,
      history: [
        {
          id: 'rev-web-fork1-2',
          type: 'edited',
          summary: 'Added counter.js module, button markup in index.html, and button styling',
          actorId: 'user-ananya',
          actorName: 'Ananya K',
          actorHandle: '@ananya',
          timestamp: hoursAgo(2),
          addedLines: 31,
          removedLines: 3,
          filesChanged: ['index.html', 'app.js', 'styles.css', 'counter.js'],
          snapshotFiles: webDemoFork1Files,
        },
        {
          id: 'rev-web-fork1-1',
          type: 'forked',
          summary: 'Forked from Three-file web demo by Rishi Jayaram',
          actorId: 'user-ananya',
          actorName: 'Ananya K',
          actorHandle: '@ananya',
          timestamp: hoursAgo(3),
          addedLines: 0,
          removedLines: 0,
          filesChanged: [],
          parentId: 'three-file-web-demo',
          parentTitle: 'Three-file web demo',
          snapshotFiles: webDemoV1Files,
        },
      ],
    },
    {
      id: 'three-file-web-demo-v2',
      title: 'Three-file web demo (Nested v2)',
      description:
        'Second-generation fork adding pluralized file counts and live document title updates.',
      visibility: 'public',
      tags: ['demo', 'javascript'],
      ownerId: 'user-rishi',
      ownerName: 'Rishi Jayaram',
      ownerHandle: '@rishi',
      forkedFrom: {
        id: 'three-file-web-demo-interactive',
        title: 'Three-file web demo (Interactive counter)',
        ownerName: 'Ananya K',
      },
      forkOriginFiles: webDemoFork1Files,
      starredBy: ['user-rishi'],
      createdAt: hoursAgo(1.5),
      updatedAt: hoursAgo(1),
      files: webDemoFork2Files,
      history: [
        {
          id: 'rev-web-fork2-2',
          type: 'edited',
          summary: 'Pluralized active file label and synced document.title on click',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(1),
          addedLines: 6,
          removedLines: 3,
          filesChanged: ['app.js'],
          snapshotFiles: webDemoFork2Files,
        },
        {
          id: 'rev-web-fork2-1',
          type: 'forked',
          summary: 'Forked from Three-file web demo (Interactive counter) by Ananya K',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(1.5),
          addedLines: 0,
          removedLines: 0,
          filesChanged: [],
          parentId: 'three-file-web-demo-interactive',
          parentTitle: 'Three-file web demo (Interactive counter)',
          snapshotFiles: webDemoFork1Files,
        },
      ],
    },
    {
      id: 'fastapi-rag-template',
      title: 'fastapi-rag-template',
      description:
        'Modular FastAPI retrieval pipeline separating API routing, chunk ranking, and embedding utilities.',
      visibility: 'public',
      tags: ['python', 'fastapi', 'demo'],
      ownerId: 'user-ananya',
      ownerName: 'Ananya K',
      ownerHandle: '@ananya',
      starredBy: ['user-rishi', 'user-ananya'],
      createdAt: hoursAgo(28),
      updatedAt: hoursAgo(18),
      files: ragOriginalFiles,
      history: [
        {
          id: 'rev-rag-1',
          type: 'created',
          summary: 'Created FastAPI RAG starter with 3 modules',
          actorId: 'user-ananya',
          actorName: 'Ananya K',
          actorHandle: '@ananya',
          timestamp: hoursAgo(28),
          addedLines: 39,
          removedLines: 0,
          filesChanged: ['main.py', 'routers/query.py', 'utils/embed.py'],
          snapshotFiles: ragOriginalFiles,
        },
      ],
    },
    {
      id: 'fastapi-rag-hybrid',
      title: 'fastapi-rag-hybrid',
      description:
        'Forked from fastapi-rag-template with Pydantic bounds validation and hybrid semantic + lexical scoring.',
      visibility: 'public',
      tags: ['python', 'fastapi', 'demo'],
      ownerId: 'user-rishi',
      ownerName: 'Rishi Jayaram',
      ownerHandle: '@rishi',
      forkedFrom: {
        id: 'fastapi-rag-template',
        title: 'fastapi-rag-template',
        ownerName: 'Ananya K',
      },
      forkOriginFiles: ragOriginalFiles,
      starredBy: ['user-ananya'],
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(5),
      files: ragForkFiles,
      history: [
        {
          id: 'rev-rag-fork-2',
          type: 'edited',
          summary: 'Added hybrid_rank scoring and request Field bounds in routers/query.py',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(5),
          addedLines: 17,
          removedLines: 6,
          filesChanged: ['routers/query.py', 'utils/embed.py'],
          snapshotFiles: ragForkFiles,
        },
        {
          id: 'rev-rag-fork-1',
          type: 'forked',
          summary: 'Forked from fastapi-rag-template by Ananya K',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(10),
          addedLines: 0,
          removedLines: 0,
          filesChanged: [],
          parentId: 'fastapi-rag-template',
          parentTitle: 'fastapi-rag-template',
          snapshotFiles: ragOriginalFiles,
        },
      ],
    },
    {
      id: 'docker-setup',
      title: 'docker-setup',
      description:
        'Multi-stage container build, Compose service definitions, and hardened Nginx reverse proxy with nosniff raw headers.',
      visibility: 'public',
      tags: ['docker', 'nginx', 'devops'],
      ownerId: 'user-rishi',
      ownerName: 'Rishi Jayaram',
      ownerHandle: '@rishi',
      starredBy: ['user-ananya'],
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(2),
      files: dockerFiles,
      history: [
        {
          id: 'rev-docker-1',
          type: 'created',
          summary: 'Created multi-stage Docker and Nginx raw proxy setup',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(8),
          addedLines: 49,
          removedLines: 0,
          filesChanged: ['Dockerfile', 'docker-compose.yml', 'nginx.conf'],
          snapshotFiles: dockerFiles,
        },
      ],
    },
    {
      id: 'llm-caching',
      title: 'llm-caching',
      description:
        'Deterministic prompt-hash Redis cache wrapper preventing duplicate upstream requests.',
      visibility: 'public',
      tags: ['python', 'redis', 'caching'],
      ownerId: 'user-ananya',
      ownerName: 'Ananya K',
      ownerHandle: '@ananya',
      starredBy: ['user-rishi'],
      createdAt: hoursAgo(74),
      updatedAt: hoursAgo(50),
      files: llmCacheFiles,
      history: [
        {
          id: 'rev-llm-1',
          type: 'created',
          summary: 'Created Redis prompt cache utility',
          actorId: 'user-ananya',
          actorName: 'Ananya K',
          actorHandle: '@ananya',
          timestamp: hoursAgo(74),
          addedLines: 31,
          removedLines: 0,
          filesChanged: ['cache.py', 'redis_client.py'],
          snapshotFiles: llmCacheFiles,
        },
      ],
    },
    {
      id: 'rate-limit-draft',
      title: 'rate-limit-draft',
      description:
        'Private sliding-window rate limiter owned by Rishi. Blocked for anonymous viewers and embeds.',
      visibility: 'private',
      tags: ['security', 'typescript'],
      ownerId: 'user-rishi',
      ownerName: 'Rishi Jayaram',
      ownerHandle: '@rishi',
      starredBy: [],
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(4),
      files: rateLimitFiles,
      history: [
        {
          id: 'rev-rl-1',
          type: 'created',
          summary: 'Created private sliding-window limiter draft',
          actorId: 'user-rishi',
          actorName: 'Rishi Jayaram',
          actorHandle: '@rishi',
          timestamp: hoursAgo(6),
          addedLines: 29,
          removedLines: 0,
          filesChanged: ['src/limiter.ts', 'src/limiter.test.ts'],
          snapshotFiles: rateLimitFiles,
        },
      ],
    },
  ];
}
