# Turtle Guard

A field data platform for sea turtle conservation teams: nest records, morning
beach surveys, tagging, and turtle records, built for the people who collect
this data at dawn on a beach with patchy signal — not for people at a desk.

**Live app:** https://joshaa50.github.io/turtle-frontend/
**API / backend:** [turtle-backend](https://github.com/joshaa50/turtle-backend)

Try it without an account using one of the demo role buttons on the login
screen (Coordinator, Field Leader, Field Assistant, Field Volunteer) — each
shows the app as that role sees it.

## What it does

- **Nest Records** — log a new nest with its location, egg count, and
  triangulation photos; track it through incubation, hatching and excavation.
- **Morning Survey** — the daily beach walk: record tracks, new nests and
  emergences across every beach in a region in one pass.
- **Tagging Entry** — record a turtle encounter and its physical measurements.
- **Turtle Records** — a searchable history for every tagged individual.
- **Time Table** — weekly shift scheduling for the field team.
- **Nest Map** — every recorded nest plotted for the team to see.
- **Review Queue** — a Field Volunteer's record saves the moment they submit
  it; a Field Leader confirms it afterwards. Nobody waits on a reviewer to
  finish their fieldwork.
- **User Management** — a Coordinator or Field Leader approves new accounts
  and manages roles.
- Works offline: a survey or nest entry made with no signal is queued on the
  device and sent once the connection returns, rather than lost.

An AI assistant (Google Gemini, called from the backend only) can answer
plain-language questions over the nest data and transcribe a dictated field
note into a structured entry.

## Who sees what

Four roles, enforced by the API and not just hidden in the UI:

| Role | Can do |
|---|---|
| Field Volunteer | Record nests, surveys, turtles and tagging events (held for review) |
| Field Assistant | Same, without the review hold |
| Field Leader | Everything above, plus approve accounts, review volunteer submissions, manage the schedule |
| Project Coordinator | Full access |

See [PRIVACY.md](./PRIVACY.md) for what data the app stores and who can see
it — worth reading before pointing this at real field data.

## Tech

React 19 + TypeScript + Vite, Tailwind, deployed to GitHub Pages. Talks to
the [turtle-backend](https://github.com/joshaa50/turtle-backend) Express API
(Node + PostgreSQL on Neon, hosted on Render).

## Run locally

**Prerequisites:** Node.js

```
npm install
npm run dev
```

By default the app talks to the live backend at
`https://turtle-backend-pxcx.onrender.com`. To point it at a different API
(for local backend development, or a throwaway QA instance), set
`VITE_API_URL` in `.env.local`.

The backend sleeps after a period of inactivity on its current hosting tier —
the first request of the day can take up to a minute to wake it. The demo
login buttons handle this with a retry and a "waking up" message; a slow
first load elsewhere in the app is the same thing, not a bug.

## Testing

```
npm test        # unit tests (vitest)
npm run lint    # typecheck
npm run build   # production build
```

## Status

Actively developed and undergoing a structured QA process (numeric-range
validation, role-based access control, and offline-data-loss scenarios have
each had a dedicated audit). Suitable for a pilot with a conservation team;
see [PRIVACY.md](./PRIVACY.md) for the current data-handling posture before
using it with a real, active nesting season.
