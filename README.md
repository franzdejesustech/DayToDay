# DayToDay

DayToDay is a responsive personal productivity workspace for tasks, lists, calendar planning, habits, focus sessions, notes, reminders, and reflection.

## Included

- Task CRUD with priorities, tags, subtasks, dates, recurrence, and multiple reminders
- Folders, lists, smart lists, natural-language quick add, search, and filtering
- List, calendar, Kanban, timeline, and Eisenhower matrix views
- Habit streaks and heatmaps, a configurable Pomodoro timer, and focus statistics
- Standalone or task-attached notes, countdowns, and daily reflection
- Supabase Auth, per-user Row Level Security, and responsive desktop/mobile layouts

## Run locally

Install dependencies, add the Supabase values to `.env.local`, then start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase

The app uses Supabase Auth with a publishable browser key. Its public tables are protected by per-user Row Level Security policies. Keep secret and `service_role` keys out of the client environment.

## Google Calendar

The Calendar view uses Google Identity Services and the Google Calendar API directly from the browser. To enable it:

1. Enable the Google Calendar API in a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an **OAuth 2.0 Client ID** for a Web application.
4. Add `http://localhost:3000` and `http://127.0.0.1:3000` as authorized JavaScript origins for local development, plus the production site origin when deploying.
5. Put the Web client ID in `.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, then restart the development server.

Only the public Web client ID belongs in `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Do not add a Google client secret to browser code.
