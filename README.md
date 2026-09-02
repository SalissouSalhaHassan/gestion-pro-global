This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database Migrations & Security (RLS)

This project includes database migrations located in the `/migrations` directory.

### Row-Level Security (RLS) Policies
A comprehensive Row-Level Security (RLS) script is provided in:
`migrations/20260902_comprehensive_rls_security.sql`

To apply it to your Supabase PostgreSQL database:
1. Open your [Supabase Dashboard](https://app.supabase.com).
2. Go to **SQL Editor**.
3. Copy and paste the contents of `migrations/20260902_comprehensive_rls_security.sql`.
4. Click **Run**.

This establishes:
- Tenant data isolation (`organization_id`).
- Safe public portal access for customer invoice receipts (`/invoice/[id]`).
- Protection of sensitive business records (Stocks, Factures, Loyers, Voitures, Paiements, etc.).
- Direct integration with `x-organization-id` headers in `lib/supabase/client.ts` and `lib/supabase/server.ts`.

