# Ribra

**Your AI co-pilot for landing the job, from CV to offer.**

Ribra scores your CV like an ATS, matches it against real job descriptions, writes tailored cover letters, preps you for interviews and tracks every application on one board.

> Status: **Stage 1 · Accounts** (sign up, log in, secure sessions, protected dashboard)

Live: https://ribra.vercel.app

## Tech stack

| Layer    | Tools                                                     |
| -------- | --------------------------------------------------------- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4                |
| Backend  | Node.js 22, Express 5, TypeScript, Mongoose, Zod, Pino    |
| Database | MongoDB Atlas                                             |
| AI       | OpenAI API (from Stage 3)                                 |
| Quality  | ESLint, Prettier, Vitest, Supertest, GitHub Actions CI    |
| Hosting  | Vercel (frontend), Render (API), MongoDB Atlas (database) |

## Project structure

```
ribra/
├── client/   # React app (Vercel)
├── server/   # Express API (Render)
└── .github/  # CI workflow
```

## Run it locally

Requirements: Node.js 22.12 or newer.

```bash
npm install                                  # installs client + server
cp server/.env.example server/.env           # then paste your MongoDB Atlas URI
npm run dev                                  # API on :4000, web on :5173
```

Open http://localhost:5173. The status card shows whether the API and database are connected.

## Scripts (run from the project root)

| Command          | What it does                              |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Start API and frontend together           |
| `npm run check`  | Lint, type-check, test and build, like CI |
| `npm test`       | Run all tests                             |
| `npm run format` | Format all code with Prettier             |

## API

| Method | Route            | Description                                 |
| ------ | ---------------- | ------------------------------------------- |
| GET    | `/api/v1/health` | API status, version and database connection |

## Roadmap

- [x] Stage 0: Foundation
- [x] Stage 1: Authentication
- [ ] Stage 2: App shell and landing page
- [ ] Stage 3: CV upload and AI analyzer
- [ ] Stage 4: CV vs job match
- [ ] Stage 5: Application tracker
- [ ] Stage 6: Cover letters and interview prep
- [ ] Stage 7: Plans and payments (Paystack)
- [ ] Stage 8: Reminders and analytics
- [ ] Stage 9: Admin and polish
- [ ] Stage 10: Launch
