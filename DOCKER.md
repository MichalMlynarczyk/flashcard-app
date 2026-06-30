# Docker

## Run locally

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
```

Open:

```text
http://localhost
```

The backend is also exposed on:

```text
http://localhost:5001
```

On the current server, open:

```text
http://45.93.139.211/
```

The frontend build uses:

```text
http://45.93.139.211:5001/api
```

## Data files

The Docker images do not include app data. Keep these paths next to the repo and Docker Compose will mount them into the backend container:

```text
backend/.env
backend/wordse.db
backend/books
backend/prepared_books
processed_images
```

If you clone this repo on another computer, copy those paths from the original machine to keep the prepared Harry Potter and Warcraft books, existing users, words, bookmarks, and OCR assets.
