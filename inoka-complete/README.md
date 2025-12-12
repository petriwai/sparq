# INOKA Rideshare

Local rideshare app for Springfield, IL — built to compete with Uber/Lyft.

## Features

### Rider App
- Request rides with real-time map
- Save favorite places
- Multiple ride options (Saver, Standard, XL, Black)
- Secure payments via Stripe
- Tip your driver
- Schedule rides in advance
- Quiet ride & pet-friendly preferences

### Driver Portal
- Driver registration with license verification
- Vehicle management
- Illinois TNC compliance (Zero-Tolerance policy)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth & Database**: Supabase (Auth + Postgres + RLS)
- **Payments**: Stripe (saved cards, manual capture, tips)
- **Maps**: Google Maps (Geocoding, Places, Maps JavaScript API)
- **Styling**: Tailwind CSS

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only!)
- `GOOGLE_MAPS_API_KEY` - Server-side Google API key (no HTTP restrictions)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Browser Google API key (domain-restricted)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `NEXT_PUBLIC_APP_URL` - Your app URL

### 3. Supabase Setup
1. Run `supabase-setup.sql` in your Supabase SQL Editor
2. Configure Auth Redirect URLs in Supabase Dashboard:
   - `http://localhost:3000/*`
   - `https://yourdomain.com/*`

### 4. Google Cloud Setup
Enable these APIs in Google Cloud Console:
- Geocoding API
- Places API
- Maps JavaScript API

Create two API keys:
- **Server key**: Restrict by API only (Geocoding + Places)
- **Browser key**: Restrict by HTTP referrer (your domain)

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import to Vercel
3. Add all environment variables
4. Deploy

### Important Security Notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Use domain restrictions on your browser Google API key
- Enable RLS policies on all Supabase tables

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── geocode/route.ts    # Location search API
│   │   └── stripe/route.ts     # Payment processing API
│   ├── driver/page.tsx         # Driver registration
│   ├── payment-methods/page.tsx # Manage saved cards
│   ├── reset-password/page.tsx # Password reset flow
│   ├── privacy/page.tsx        # Privacy policy
│   ├── terms/page.tsx          # Terms of service
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main rider app
├── lib/
│   └── supabase.ts             # Supabase client
├── public/
│   └── manifest.json           # PWA manifest
└── supabase-setup.sql          # Database schema + RLS
```

## License

MIT
