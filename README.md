# Ribra

**Your AI co-pilot for landing the job, from CV to offer.**

Ribra scores your CV like an Applicant Tracking System (ATS), matches it against real job descriptions, and tells you exactly what to fix. Cover letters, interview prep and an application tracker are next.

**Live:** https://ribra.vercel.app

> Status: accounts (email, Google), AI CV analyzer and CV-vs-job matching are live.

## Features

- **Accounts**: sign up with email or Google, email confirmation, forgot/reset password, secure sessions that survive refreshes.
- **AI CV Analyzer**: upload a PDF, Word or text CV and get an overall score, five sub-scores (ATS readiness, impact, skills, structure, clarity), prioritised fixes, rewritten bullet points and a skills breakdown. Every report is saved.
- **Job Match**: paste a job description to get a match score, required/nice-to-have keywords found or missing in your CV, fit strengths and gaps, tailoring tips per CV section and a suggested summary.
- **Fair usage**: free monthly limits per feature, counted atomically and refunded if the AI call fails.

## Tech stack

| Layer    | Tools                                                                      |
| -------- | -------------------------------------------------------------------------- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, React Router, TanStack Query   |
| Backend  | Node.js 22, Express 5, TypeScript, Mongoose, Zod, Pino                     |
| Database | MongoDB Atlas                                                              |
| AI       | Any OpenAI-compatible API (Google Gemini free tier by default)             |
| Email    | Brevo HTTP API                                                             |
| Quality  | ESLint, Prettier, Vitest, Supertest, mongodb-memory-server, GitHub Actions |
| Hosting  | Vercel (frontend + `/api` proxy), Render (API), MongoDB Atlas              |

## Architecture

```
Browser ──► Vercel (React app)
              │  /api/* is proxied, so cookies stay first-party
              ▼
           Render (Express API) ──► MongoDB Atlas
                                ├─► Gemini (OpenAI-compatible API)
                                ├─► Brevo (email over HTTPS)
                                └─► Google (sign-in key check)
```

```
ribra/
├── client/            # React app
│   └── src/
│       ├── app/        # routes (pages are code-split)
│       ├── components/ # UI, layout, auth, CV components
│       ├── features/   # API hooks + types per feature (auth, cv, jobs)
│       ├── pages/
│       └── stores/     # auth state (Zustand)
├── server/            # Express API
│   ├── src/
│   │   ├── ai/         # provider-agnostic AI client, prompts, privacy redaction
│   │   ├── modules/    # auth, users, resumes, jobMatches, usage, email, health
│   │   └── middleware/ # auth, validation, rate limits, errors
│   ├── scripts/        # ai-check
│   └── tests/
└── .github/workflows/ # CI
```

## Run it locally

Requirements: Node.js 22.12 or newer and a MongoDB Atlas connection string.

```bash
npm install
cp server/.env.example server/.env   # add MONGODB_URI and AI_API_KEY
npm run dev                          # API on :4000, web on :5173
npm run ai:check -w server           # optional: check your AI key and models
```

Without `BREVO_API_KEY`, emails (confirmation, password reset) are printed in the terminal so you can click the link. Without `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`, the Google button is hidden.

## Scripts (run from the project root)

| Command          | What it does                              |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Start API and frontend together           |
| `npm run check`  | Lint, type-check, test and build, like CI |
| `npm test`       | Run all tests                             |
| `npm run format` | Format all code with Prettier             |

## API

All routes are under `/api/v1` and return JSON. Errors look like `{ "error": { "code", "message", "details?" } }`.

| Method | Route                              | Auth   | Description                                                     |
| ------ | ---------------------------------- | ------ | --------------------------------------------------------------- |
| GET    | `/health`                          | -      | API, database and AI status                                     |
| POST   | `/auth/register`                   | -      | Create an account and send a confirmation email                 |
| POST   | `/auth/login`                      | -      | Log in; returns an access token and sets the refresh cookie     |
| POST   | `/auth/google`                     | -      | Sign in or sign up with a Google ID token                       |
| POST   | `/auth/refresh`                    | cookie | Rotate the refresh cookie and get a new access token            |
| POST   | `/auth/logout`                     | cookie | End the current session                                         |
| GET    | `/auth/me`                         | Bearer | The logged-in user                                              |
| POST   | `/auth/verify-email`               | -      | Confirm an email address with the emailed token                 |
| POST   | `/auth/resend-verification`        | Bearer | Send a new confirmation email                                   |
| POST   | `/auth/forgot-password`            | -      | Email a reset link (same reply whether or not the email exists) |
| POST   | `/auth/reset-password`             | -      | Set a new password with the emailed token; ends all sessions    |
| GET    | `/resumes`                         | Bearer | The user's CVs with their latest score                          |
| POST   | `/resumes`                         | Bearer | Upload a CV (PDF, DOCX or TXT, max 5 MB)                        |
| DELETE | `/resumes/:id`                     | Bearer | Delete a CV with its reports and job matches                    |
| POST   | `/resumes/:id/analyze`             | Bearer | Run the AI CV analysis                                          |
| GET    | `/analyses`, `/analyses/:id`       | Bearer | Past CV reports                                                 |
| POST   | `/job-matches`                     | Bearer | Compare a saved CV with a pasted job description                |
| GET    | `/job-matches`, `/job-matches/:id` | Bearer | Past job matches                                                |
| DELETE | `/job-matches/:id`                 | Bearer | Delete a job match                                              |
| GET    | `/usage`                           | Bearer | AI uses left this month                                         |

## How it works

### Authentication

- **Access token**: a JWT valid for 15 minutes, kept in memory in the browser and sent as `Authorization: Bearer`.
- **Refresh token**: a random secret in an `httpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth`, valid for 7 days. Only its SHA-256 hash is stored.
- **Rotation**: every refresh issues a new refresh token. Reusing an old one ends all of the user's sessions (stolen-token protection).
- **Email links**: one-time random tokens, stored only as hashes, used up atomically, expiring after 24 hours (confirm email) or 30 minutes (reset password). A password reset ends every session.
- **Google sign-in**: the API verifies the Google ID token's signature against Google's public keys, its issuer and our client ID, then signs the user in, creates them, or links Google to an existing account with the same verified email.
- **Hardening**: bcrypt (12 rounds), rate limits on login, sign-up, email and AI routes, identical answers for unknown emails, Zod validation on every request, secrets redacted from logs.

### AI CV analysis

1. **Upload**: the file stays in memory, its real type is checked from its first bytes, and only the extracted text is saved.
2. **Privacy**: emails, phone numbers and links are removed before the text is sent to the AI.
3. **Usage limit**: one use is reserved atomically in MongoDB before the AI call and given back if the call fails.
4. **AI call**: one small provider-agnostic client (`server/src/ai/aiClient.ts`) asks for JSON matching a Zod schema, validates it, asks the model to repair invalid JSON once, and falls back to the next model in `AI_MODELS` when one is out of quota.
5. **Result**: scores are clamped to 0-100, lists are capped, and the report is saved with the model and prompt version that produced it.

### Job match score

- The AI extracts 8-20 keywords from the job description (marked _required_ or _preferred_) and judges overall fit.
- Ribra's own code then checks which keywords really appear in the CV, handling synonyms (`Node.js` / `NodeJS`) and whole-word matching (`Java` is not `JavaScript`). The result is the same every time.
- **Match score = 60% AI fit + 40% keyword coverage** (required keywords count double).
- The same CV + job description is cached by hash, so re-checking it is instant and free.

## Roadmap

- [x] Stage 0: Foundation (monorepo, CI, deploys)
- [x] Stage 1: Accounts (email + password, Google, email confirmation, password reset)
- [x] Stage 3: AI CV analyzer
- [x] Stage 4: CV vs job match
- [ ] Stage 5: Application tracker
- [ ] Stage 6: Cover letters and interview prep
- [ ] Stage 7: Plans and payments (Paystack)
- [ ] Stage 8: Reminders and analytics
- [ ] Stage 9: Admin and polish
- [ ] Stage 10: Launch
