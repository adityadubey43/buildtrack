# BuildTrack — Deployment Guide

**Stack:** Frontend (Next.js) → **Vercel** · Backend (Express) → **Render** · DB → **MongoDB Atlas** · Files → **Cloudinary**

Repo layout:
```
AC SAAS/
  ac-saas/    ← frontend (Next.js)
  backend/    ← backend (Express)
```

---

## 1. Cloudinary (file storage) — 5 min
1. Create a free account at cloudinary.com
2. Dashboard → copy the **API Environment variable** (`CLOUDINARY_URL=cloudinary://key:secret@cloud`)
3. You'll paste this into Render below. (If it's not set, the API falls back to local disk — fine for dev, **not** for production.)

## 2. MongoDB Atlas
- You already have a cluster. Go to **Network Access** → add `0.0.0.0/0` (allow from anywhere) so Render can connect.
- Keep your existing `MONGODB_URI`.

## 3. Backend → Render
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. It reads `backend/render.yaml`.
   (Or **New → Web Service** manually: Root Directory `backend`, Build `npm install`, Start `npm start`.)
3. Set environment variables (Render dashboard):
   - `MONGODB_URI` — your Atlas string
   - `JWT_SECRET` — a long random string
   - `CLIENT_URL` — your Vercel URL (fill after step 4, then redeploy)
   - `CLOUDINARY_URL` — from step 1
4. Deploy. Note the URL, e.g. `https://buildtrack-api.onrender.com`. Check `/health`.

> Render free tier sleeps after ~15 min idle (first request then takes ~50s). Fine for demos; upgrade for always-on.

## 4. Frontend → Vercel
1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory:** `ac-saas`
3. Environment variable:
   - `NEXT_PUBLIC_API_URL = https://buildtrack-api.onrender.com/api`
4. Deploy. Note the URL, e.g. `https://buildtrack.vercel.app`.
5. Go back to Render → set `CLIENT_URL` to the Vercel URL → redeploy backend.

## 5. Seed the platform owner & roles (against the live DB)
The Atlas DB is shared, so existing accounts already work. To (re)create them:
```
cd backend
node scripts/seedPlatformAdmin.js   # owner@buildtrack.in / Owner@123
node scripts/seedRoles.js           # role logins for the demo company
```

## 6. Done — login doors
- Company users & owner: `https://buildtrack.vercel.app/login`
- A specific company: `https://buildtrack.vercel.app/c/<company-slug>`

---

## Notes / Phase 2
- **Custom domain:** add `buildtrack.in` in Vercel; point `CLIENT_URL` to it.
- **Subdomains per company** (`acme.buildtrack.in`): add a wildcard domain `*.buildtrack.in` in Vercel + Next.js middleware to map subdomain → tenant slug. Backend is unchanged.
- **Real revenue:** integrate Razorpay; the platform dashboard's "MRR (plan-based)" becomes actual collected revenue.
- **CORS** already allows your `CLIENT_URL` plus any `*.vercel.app` / `*.netlify.app` preview URL.
