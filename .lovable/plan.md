## What we're building

A full-stack medication reminder app with secure auth, per-user medicine schedules, in-browser notifications, email backup reminders, taken/missed logging, and an adherence dashboard. Calm pastel health visual style (soft mint/lavender, friendly consumer-health feel).

## Stack (replaces Express+MongoDB from your spec)

- React 19 + TanStack Start (file-based routes, SSR-ready)
- Lovable Cloud (Postgres + managed email/password auth — handles password hashing, JWT sessions, and refresh tokens securely)
- Lovable Emails (built-in transactional email for backup reminders)
- TanStack server routes for the cron endpoint that sends email reminders
- Tailwind v4 + shadcn/ui components, recharts for the adherence chart

Every feature you asked for is delivered — only the underlying tech differs.

## Pages & routes

```text
/                       Landing (hero + CTA to sign up / log in)
/login                  Email + password sign in
/signup                 Email + password registration
/_authenticated/        Protected layout (redirects to /login if signed out)
  /dashboard            Today's schedule, stats cards, weekly adherence chart
  /medicines            List + add/edit/delete medicines
  /history              Log of taken/missed doses, filterable by date
  /settings             Notification permission, email reminders toggle, sign out
```

## Core features

**1. Auth**
- Email/password via Lovable Cloud (passwords hashed server-side, sessions via secure JWT — no need to roll bcrypt ourselves)
- Protected routes via TanStack `_authenticated` layout with `beforeLoad` redirect
- Sign out clears session

**2. Medicine management**
- Add medicine: name, dosage (e.g. "1 tablet", "5ml syrup"), notes
- Multiple reminder times per day (HH:MM list)
- Frequency: daily / alternate days / specific weekdays / custom interval
- Start date + optional end date
- Edit and delete; all rows scoped to `user_id` with RLS

**3. Smart reminder system**
- Browser Notifications API; permission requested on first dashboard visit
- A background scheduler hook computes today's due slots from the medicines table and fires a notification at each scheduled time
- Notification body: medicine name, dosage, time due
- Action buttons: **Taken** (logs status, dismisses) and **Snooze 10 min** (re-fires after delay)
- De-dup: a `(medicine_id, scheduled_for)` row is created in `dose_logs` the first time a slot fires; subsequent triggers for the same slot are skipped — survives page refresh because state lives in the DB
- If a slot's time passes without action, a daily sweep marks it `missed`

**4. Email backup reminders**
- Server route `/api/public/cron/send-reminders` runs every 5 minutes via pg_cron
- Finds dose slots due in the next 5 minutes that are still pending and the user has email reminders enabled
- Sends a "Time for your medicine" email through Lovable Emails (one per dose, idempotent on `dose_log.id`)

**5. Health adherence dashboard**
- Cards: Total medicines, Today's doses (taken / pending / missed), 7-day adherence %
- Today's schedule list with color chips: green = taken, yellow = pending, red = missed; quick "Mark taken" button on each
- Weekly adherence bar chart (recharts)
- Empty states with CTA to add first medicine

## Data model (Postgres / Lovable Cloud)

```text
profiles                id (uuid, = auth.users.id), email, email_reminders_enabled (bool default true), created_at
medicines               id, user_id (fk), name, dosage, times (text[] of HH:MM),
                        frequency_type ('daily'|'alternate'|'weekdays'|'interval'),
                        frequency_config (jsonb), start_date, end_date (nullable), active (bool), created_at
dose_logs               id, user_id, medicine_id, scheduled_for (timestamptz),
                        status ('pending'|'taken'|'missed'|'snoozed'),
                        taken_at (nullable), email_sent_at (nullable),
                        UNIQUE (medicine_id, scheduled_for)
```

RLS: every table — users can only read/write rows where `user_id = auth.uid()`. `profiles` row auto-created via trigger on signup.

## Visual design

Calm pastel health palette:
- Background: soft off-white / very light mint
- Primary: muted teal-mint
- Accent: soft lavender
- Status: gentle green (taken), warm amber (pending), soft coral (missed)
- Rounded cards (rounded-2xl), generous spacing, Inter/system font, subtle shadows
- Fully responsive (mobile-first; dashboard stacks to single column under sm)

## Out of scope for v1

- Habit tracker (water/sleep/exercise) — you chose to skip
- Push notifications when browser is fully closed (would need a PWA + service worker — email backup covers this case)
- Multi-user/family profiles, medicine inventory/refill tracking

## Build order

1. Enable Lovable Cloud, scaffold auth (signup/login/protected layout)
2. DB schema + RLS + signup trigger for profiles
3. Medicines CRUD page
4. Dose-slot generator + dashboard with today's schedule and stats
5. Browser notification scheduler hook + Taken/Snooze actions
6. Weekly adherence chart + history page
7. Email reminders: domain setup, template, cron route, settings toggle
8. Polish: empty states, responsive pass, landing page