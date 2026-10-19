# FitTrack

FitTrack is a Next.js frontend backed by a FastAPI service and MongoDB.

## Run locally

1. Install the frontend dependencies with `npm install`.
2. Install the backend dependencies with `python -m pip install -r backend/requirements.txt`.
3. Copy `backend/.env.example` to `backend/.env` and set a private `JWT_SECRET_KEY` and your `MONGODB_URI`.
4. Start MongoDB, then start the backend from the repository root:

   ```powershell
   python -m uvicorn main:app --app-dir backend --reload
   ```

5. In another terminal, start the frontend with `npm run dev`.

The frontend defaults to `http://127.0.0.1:8000`. Set `NEXT_PUBLIC_API_URL` if the
backend runs elsewhere. Set `CORS_ORIGINS` in `backend/.env` to a comma-separated
list of allowed frontend origins when deploying (local origins are allowed by
default).

## Validate

```powershell
npm test
npm run lint
npm run build
python -m unittest discover -s backend\tests -v
```

The backend tests use isolated in-memory collection fakes and do not require a
running MongoDB instance.
