# AI chat + Postgres

[![Deploy to Inferra](https://inferralab.com/assets/deploy-to-inferra.svg)](https://github.com/new?template_owner=inferra-AI&template_name=template-ai-chat)

A small Express app serves a chat UI, calls an OpenAI-compatible Chat Completions endpoint, and atomically stores successful user/assistant turns in Postgres.

## Deploy

1. Click **Deploy to Inferra** or **Use this template** to create your repository with a `main` branch.
2. Install the Inferra GitHub App and grant it access to your new repository.
3. Add the database to your account repository (below), set the `OPENAI_API_KEY` secret in Inferra, then push to `main`. Inferra builds with buildpacks and deploys the app.

This repository uses Inferra configuration version 3:

- `.inferra/repo.yaml` says which branches run (only `main`).
- `.inferra/app.yaml` says how the `chat` app builds and runs, and binds the service named `db`.

### Add the database to your account repository

Services are declared once per account, in your private `<account>/.inferra` repository, not in this repository. Add `services/chat-db.yaml` there (any file name works) and replace `template-ai-chat` under `attach:` with your repository's name:

```yaml
version: 3
name: db
type: postgres
hosting: native
data: dedicated
cpu: 0.25
memory: 256Mi
storage: 1Gi
attach:
  template-ai-chat:   # your repository's name
    branches: [main]
    access: readwrite
```

The app binds `db`, so Inferra gives it `DB_URL`. If your account repository has an `account.yaml`, also list this repository under `repos:` with a quota. Keep credentials out of configuration files.

## Local run

Use Node.js 22 and Docker Compose. Start local dependencies and copy the environment example:

```sh
docker compose up -d
cp .env.example .env
# Edit .env: set OPENAI_API_KEY, and the base URL and model if you use another provider.
set -a
. ./.env
set +a
npm ci
npm run build
npm start
# Open http://localhost:3000
```

Wait until Postgres is ready if the first request fails. Variables must be exported in every terminal used to start an app. `docker compose down` stops local services; `docker compose down -v` also removes local data.

Set `OPENAI_API_KEY` to your provider key. `OPENAI_BASE_URL` is the API root including its version path (for example, `https://provider.example/v1`); the app appends `/chat/completions`. Set `OPENAI_MODEL` to a model supported by that provider. Any compatible text Chat Completions endpoint can be used; no OpenAI SDK is required.

`.inferra/app.yaml` lists `OPENAI_API_KEY` as a secret name only. Set its value in Inferra before deployment; never put it in YAML or source control. The plain `OPENAI_BASE_URL` and `OPENAI_MODEL` defaults live under `env:` in `.inferra/app.yaml`.

A conversation UUID is saved in browser local storage; its messages persist in Postgres across restarts. The `messages` table is created on the first health or API request. Provider errors return a generic error and do not store a partial turn. The key stays on the server.

This is a starter with no authentication or rate limiting. Conversation UUIDs are bearer identifiers, and concurrent turns can overlap. Add authentication and usage limits before exposing a paid provider key publicly.

## Files

- `.inferra/repo.yaml`: branches that run.
- `.inferra/app.yaml`: process, port, health check, build settings, service binding, plain env and secret names.
- `Procfile`: buildpack process commands.
- `compose.yaml`: pinned local Postgres container and database volume.
- `.env.example`: local environment values; copy to ignored `.env`.
- `.gitignore`: keeps local credentials and generated files out of Git.
- `server.js`: HTTP server, provider call, validation, health endpoint, and database persistence.
- `public/index.html`: minimal chat form.
- `public/chat.js`: browser conversation ID, history loading, and message submission.
- `package.json` and `package-lock.json`: pinned direct dependencies, locked dependency tree, and run/build commands.
- `LICENSE`: MIT license.
- `README.md`: deployment and local instructions.
