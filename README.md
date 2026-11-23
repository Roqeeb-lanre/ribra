# Ribra

**Your AI co-pilot for landing the job, from CV to offer.**

Ribra scores your CV like an Applicant Tracking System (ATS), matches it against real job descriptions, tells you exactly what to fix, writes tailored cover letters, coaches you for interviews and tracks every application on one board.

**Live:** https://ribra.vercel.app

> Status: all core features are live: accounts (email, Google), AI CV analyzer, CV-vs-job matching, application tracker, cover letters and interview prep.

## Features

- **Accounts**: sign up with email or Google, email confirmation, forgot/reset password, secure sessions that survive refreshes.
- **AI CV Analyzer**: upload a PDF, Word or text CV and get an overall score, five sub-scores (ATS readiness, impact, skills, structure, clarity), prioritised fixes, rewritten bullet points and a skills breakdown. Every report is saved.
- **Job Match**: paste a job description to get a match score, required/nice-to-have keywords found or missing in your CV, fit strengths and gaps, tailoring tips per CV section and a suggested summary.
- **Application tracker**: a drag-and-drop board (Saved, Applied, Interview, Offer, Rejected) with notes, links, salary, next steps with due dates, a status timeline, and one-click "Track this job" from any job match.
- **Cover letters**: a tailored letter for any job match in three tones and two lengths, written only from real CV experience, signed with your name in code (never sent to the AI), and editable, copyable and downloadable.
- **Interview prep**: about 8 likely questions per job (motivation, behavioural, technical, role), including the candidate's gaps, with why they're asked, how to answer and which CV experience to use. Practise each answer and get a 1-10 score, strengths, improvements and a stronger version.
- **Ribra Pro**: ₦5,000/month subscription through Paystack (checkout, signed webhooks, renewals, cancel at period end, change card), with higher monthly limits.
- **Account settings**: change name and password (logs out other devices and emails a security notice), see and log out devices, download all your data as JSON, and delete your account (cancels any subscription first).
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

| Method             | Route                                          | Auth            | Description                                                     |
| ------------------ | ---------------------------------------------- | --------------- | --------------------------------------------------------------- |
| GET                | `/health`                                      | -               | API, database and AI status                                     |
| POST               | `/auth/register`                               | -               | Create an account and send a confirmation email                 |
| POST               | `/auth/login`                                  | -               | Log in; returns an access token and sets the refresh cookie     |
| POST               | `/auth/google`                                 | -               | Sign in or sign up with a Google ID token                       |
| POST               | `/auth/refresh`                                | cookie          | Rotate the refresh cookie and get a new access token            |
| POST               | `/auth/logout`                                 | cookie          | End the current session                                         |
| GET                | `/auth/me`                                     | Bearer          | The logged-in user                                              |
| POST               | `/auth/verify-email`                           | -               | Confirm an email address with the emailed token                 |
| POST               | `/auth/resend-verification`                    | Bearer          | Send a new confirmation email                                   |
| POST               | `/auth/forgot-password`                        | -               | Email a reset link (same reply whether or not the email exists) |
| POST               | `/auth/reset-password`                         | -               | Set a new password with the emailed token; ends all sessions    |
| GET                | `/resumes`                                     | Bearer          | The user's CVs with their latest score                          |
| POST               | `/resumes`                                     | Bearer          | Upload a CV (PDF, DOCX or TXT, max 5 MB)                        |
| DELETE             | `/resumes/:id`                                 | Bearer          | Delete a CV with its reports and job matches                    |
| POST               | `/resumes/:id/analyze`                         | Bearer          | Run the AI CV analysis                                          |
| GET                | `/analyses`, `/analyses/:id`                   | Bearer          | Past CV reports                                                 |
| POST               | `/job-matches`                                 | Bearer          | Compare a saved CV with a pasted job description                |
| GET                | `/job-matches`, `/job-matches/:id`             | Bearer          | Past job matches                                                |
| DELETE             | `/job-matches/:id`                             | Bearer          | Delete a job match with its cover letter and interview prep     |
| GET                | `/usage`                                       | Bearer          | AI uses left this month                                         |
| PATCH, DELETE      | `/auth/me`                                     | Bearer          | Update your name / delete your account and data                 |
| POST               | `/auth/password`                               | Bearer + cookie | Change or set your password; logs out other devices             |
| GET                | `/auth/sessions`                               | Bearer + cookie | Devices you're logged in on                                     |
| POST               | `/auth/sessions/sign-out-others`               | Bearer + cookie | Log out every other device                                      |
| GET                | `/auth/me/export`                              | Bearer          | Download all your data as JSON                                  |
| GET                | `/billing`                                     | Bearer          | Plan, subscription status and payments                          |
| POST               | `/billing/checkout`                            | Bearer          | Start a Paystack checkout for Pro                               |
| GET                | `/billing/verify/:reference`                   | Bearer          | Confirm a payment after the redirect                            |
| POST               | `/billing/manage`, `/billing/cancel`           | Bearer          | Change card on Paystack / cancel renewal                        |
| POST               | `/billing/paystack/webhook`                    | signature       | Paystack events (HMAC-SHA512 verified)                          |
| GET, POST          | `/applications`                                | Bearer          | List tracked jobs / add one                                     |
| POST               | `/applications/from-match/:matchId`            | Bearer          | Track a job match (only once per match)                         |
| GET, PATCH, DELETE | `/applications/:id`                            | Bearer          | Read, update (status changes are recorded) or delete            |
| GET, POST          | `/cover-letters`                               | Bearer          | List letters / write or rewrite one for a job match             |
| GET                | `/cover-letters/by-match/:matchId`             | Bearer          | The letter for a job match                                      |
| PATCH, DELETE      | `/cover-letters/:id`                           | Bearer          | Save edits / delete                                             |
| GET, POST          | `/interview-preps`                             | Bearer          | List prep sets / generate questions for a job match             |
| GET                | `/interview-preps/by-match/:matchId`           | Bearer          | Questions and feedback for a job match                          |
| POST               | `/interview-preps/:id/questions/:qid/feedback` | Bearer          | AI review of a practice answer                                  |
| DELETE             | `/interview-preps/:id`                         | Bearer          | Delete a prep set                                               |

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

### Cover letters and interview prep

- Both are built from a job match, so the AI sees the job description, the (redacted) CV and, for interview prep, the gaps found in the match.
- The cover letter comes back as parts (greeting, paragraphs, closing); Ribra assembles it and adds the user's name itself.
- Practice answers are reviewed one at a time, with their own monthly allowance, and the score is clamped to 1-10.
- Deleting a job match or CV deletes its letter and prep; tracked applications are kept and just lose the link.

### Payments (Paystack)

- Checkout uses a Paystack plan, so Paystack charges the card monthly. The user id travels in the transaction metadata.
- Pro is granted by **either** the signed webhook or a server-side verify call after the redirect, whichever comes first. A unique payment reference makes both safe to repeat.
- Webhooks are checked with HMAC-SHA512 over the raw request body before anything is read.
- Pro lasts until the next billing date plus 3 days' grace; cancelling stops renewals but keeps Pro until the paid month ends.

## Roadmap

- [x] Stage 0: Foundation (monorepo, CI, deploys)
- [x] Stage 1: Accounts (email + password, Google, email confirmation, password reset)
- [x] Stage 3: AI CV analyzer
- [x] Stage 4: CV vs job match
- [x] Stage 5: Application tracker
- [x] Stage 6: Cover letters and interview prep
- [x] Stage 7: Plans and payments (Paystack)
- [x] Account settings (profile, password, devices, data export, account deletion)
- [ ] Stage 8: Reminders and analytics
- [ ] Stage 9: Admin and polish
- [ ] Stage 10: Launch
