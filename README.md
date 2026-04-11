# Radiant Toolkit — Job Estimator

Local estimator and fixture library for making landscape lighting estimates.
Runs as a Docker container on your VM. Data persists in a SQLite database
mounted from the host filesystem.

## Project structure

```
radiant/
├── server.js              # Express API server
├── db.js                  # SQLite schema and queries
├── package.json
├── Dockerfile
├── docker-compose.yml
├── data/                  # Created automatically — contains radiant.db
└── public/                # Static frontend files served by Express
    ├── index.html         # Job estimator
    ├── fixture-library.html
    ├── styles.css
    └── api.js             # Shared fetch() client
```

## Quick start (Docker — recommended)

```bash
# 1. Clone or copy this folder to your VM
# 2. Build and start
docker compose up -d

# App is now running at http://<your-vm-ip>:3000
```

The `./data` directory is created automatically and holds `radiant.db`.
That's the only file you need to back up.

## Running without Docker

```bash
npm install
npm start
# or, with auto-restart on file changes:
npm run dev
```

Requires Node.js 18+.

## Backup

```bash
# Copy the database off the VM
scp user@vm-ip:/path/to/radiant/data/radiant.db ./radiant-backup-$(date +%Y%m%d).db
```

Or use the Export JSON button in the Fixture Library page to export
your fixture catalog as a portable JSON file.

## Changing the port

Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"   # expose on port 8080 instead
```

Or set the PORT environment variable when running without Docker:
```bash
PORT=8080 npm start
```

## Updating

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Your data in `./data/radiant.db` is untouched.
