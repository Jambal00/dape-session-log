# DAPE Session Log

A phone-first web app for a DAPE teacher to plan sessions, log results against IEP goals, track direct and indirect minutes, and prepare progress reports.

Live app: https://jambal00.github.io/dape-session-log/

## What it does

- **Home screen** grouped by how often each job comes up: Every day (Today's Plan, Plan my Day), A few times a year (Students and IEPs, Progress Reports) and Setup (Schools, Agencies, Drive distances). Setup lists what is still missing until it is complete.
- **Plan my Day:** a five-step planner that confirms schools and students and pre-fills each lesson plan from the last session.
- **Today's Plan:** the day as a route, with results entered per student and hours, miles and pay split by agency.
- **Students and IEPs:** each student's IEP entered in six steps (dates, disability codes, service minutes, annual goal, objectives, review). "Update after an IEP meeting" keeps the old IEP in history, and objectives that are dropped keep their data.
- **Progress Reports:** charts, averages and Goal / Objective / Progress text for SpEd Forms, for the last 30 or 90 days, all entries, or custom dates.

## Data rule

No identifiable student data. Students are entered as initials or a nickname only, including in notes. This repository holds code only, never student data.

## How it is built

- One static page: `index.html` holds the markup, styles and script, with the pay rules in `pay.js`. `manifest.webmanifest` and `icons/` make it installable to a phone's home screen.
- Hosted on GitHub Pages from the `main` branch; a push to `main` is a release.
- Supabase provides sign-in by email and password, and storage. Sign-ups are turned off, so only people added in the Supabase dashboard can sign in. Each person's rows are private to them through row-level security.
- No build step. The only dependency is the Supabase client, loaded from a CDN.

## Setup

1. Run `setup.sql` in the Supabase SQL Editor.
2. In Supabase Authentication, turn off new sign-ups and add each user with an email and password.
3. Turn on GitHub Pages for the `main` branch.

## Pay math

`pay.js` holds the pay rules (base rate, travel time, mileage rates by date, mileage from an agency office, tax miles) as plain functions. `tests/pay.test.js` checks them against worked examples whose answers are calculated by hand in the comments. Run `node tests/pay.test.js` before every push to `main`; it must end with "All pay checks passed".

## Running it locally

Serve the folder with any static web server, for example `python3 -m http.server`, and open the page.
