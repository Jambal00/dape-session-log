# DAPE Session Log

A phone-first web app for a DAPE teacher to plan sessions, log results against IEP goals, track direct and indirect minutes, and prepare progress reports.

Live app: https://jambal00.github.io/dape-session-log/

## Data rule

No identifiable student data. Students are entered as initials or a nickname only, including in notes. This repository holds code only, never student data.

## How it is built

- One static page: `index.html` holds the markup, styles and script. `manifest.webmanifest` and `icons/` make it installable to a phone's home screen.
- Hosted on GitHub Pages from the `main` branch; a push to `main` is a release.
- Supabase provides sign-in by email and password, and storage. Sign-ups are turned off, so only people added in the Supabase dashboard can sign in. Each person's rows are private to them through row-level security.
- No build step. The only dependency is the Supabase client, loaded from a CDN.

## Setup

1. Run `setup.sql` in the Supabase SQL Editor.
2. In Supabase Authentication, turn off new sign-ups and add each user with an email and password.
3. Turn on GitHub Pages for the `main` branch.

## Running it locally

Serve the folder with any static web server, for example `python3 -m http.server`, and open the page.
