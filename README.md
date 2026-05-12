# Scanlytics

Scanlytics is a Nuxt, Prisma, Postgres, and Supabase QR analytics app deployed on Vercel.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

Copy `.env.example` to `.env` for local development and fill in the required values.

## Environment Variables

The app requires these environment variables locally and in Vercel:

- `DATABASE_URL`: Postgres connection string used by Prisma.
- `SUPABASE_URL`: Supabase project URL required for the Supabase auth integration.
- `SUPABASE_KEY`: Supabase key required for the Supabase auth integration.
- `CRON_SECRET`: Secret Bearer token for the database keep-alive cron endpoint.

Set `CRON_SECRET` in Vercel. It must match the Bearer token expected by `/api/cron/keep-db-alive`.

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

## Vercel Cron

`vercel.json` configures a once-daily keep-alive request to `/api/cron/keep-db-alive` at `0 12 * * *`.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
