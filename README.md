# PitchDrop V5 — Setup Guide

---

## STEP 1 — SUPABASE DATABASE

Go to supabase.com → your project → SQL Editor → New query → paste ALL of this → Run:

```sql
-- Drop old tables if they exist (clean start)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- USERS TABLE
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  plan TEXT DEFAULT 'free',
  credits INTEGER DEFAULT 3,
  credits_used INTEGER DEFAULT 0,
  generation_count INTEGER DEFAULT 0,
  preferences JSONB,
  preference_count INTEGER DEFAULT 0,
  suspended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HISTORY TABLE
CREATE TABLE public.history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  url TEXT,
  preferences JSONB,
  variants JSONB,
  signals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS TABLE
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id TEXT UNIQUE,
  plan TEXT,
  credits INTEGER,
  amount NUMERIC,
  currency TEXT,
  status TEXT,
  order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- USER POLICIES
CREATE POLICY "users_own" ON public.users FOR ALL USING (auth.uid() = id);

-- HISTORY POLICIES
CREATE POLICY "history_select" ON public.history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history_insert" ON public.history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "history_update" ON public.history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "history_delete" ON public.history FOR DELETE USING (auth.uid() = user_id);

-- PAYMENT POLICIES
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- SERVICE ROLE BYPASS (needed for IPN webhook to add credits automatically)
CREATE POLICY "service_users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_payments" ON public.payments FOR ALL USING (auth.role() = 'service_role');
```

You should see: **Success. No rows returned** ✅

---

## STEP 2 — GET SUPABASE SERVICE ROLE KEY

1. Supabase → your project → Settings → API
2. Scroll to "Project API keys"
3. Copy the **service_role** key (NOT the anon key)
4. Save it — you need it in Step 5

---

## STEP 3 — SUPABASE AUTH SETTINGS

1. Supabase → Authentication → Settings
2. **Site URL**: paste your Vercel URL (e.g. https://pitchdrop.vercel.app)
3. **Redirect URLs** → Add: https://pitchdrop.vercel.app/auth.html
4. Save

---

## STEP 4 — UPLOAD TO GITHUB

1. Go to github.com → New repository → Name: pitchdrop → Private → Create
2. Click "uploading an existing file"
3. Extract the ZIP and upload ALL files
4. CRITICAL: Make sure the api/ folder uploads with all 4 files inside:
   - api/generate.js ✅
   - api/followup.js ✅
   - api/create-payment.js ✅
   - api/ipn.js ✅
5. Commit changes

After uploading, go to your repo and verify you can see:
- An "api" FOLDER (not individual JS files in root)
- All HTML files in root
- package.json in root
- vercel.json in root

---

## STEP 5 — DEPLOY ON VERCEL

1. Go to vercel.com → Add New Project
2. Import from GitHub → select your pitchdrop repo
3. Framework Preset: **Other** (very important — not Next.js)
4. Build Command: **leave empty**
5. Output Directory: **leave empty**
6. Click Deploy
7. Wait ~1 minute → copy your Vercel URL

---

## STEP 6 — ADD ENVIRONMENT VARIABLES

Vercel → your project → Settings → Environment Variables → Add each one:

| Variable Name | Value |
|---|---|
| GROQ_API_KEY | ************|
| NOWPAYMENTS_API_KEY | RNK4YXD-VZAMNHV-PYG4ZPK-JM6NCQD |
| SITE_URL | https://your-vercel-url.vercel.app |
| SUPABASE_URL | https://dcbwcxejjxuloanbygfw.supabase.co |
| SUPABASE_SERVICE_KEY | (the service_role key from Step 2) |

⚠️ IMPORTANT: When pasting GROQ_API_KEY, make sure there are NO spaces before or after the key. This was causing the "Invalid API Key" error.

After adding all variables → Deployments tab → click Redeploy on latest deployment.

---

## STEP 7 — SET UP NOWPAYMENTS IPN

1. Go to nowpayments.io → login
2. Go to Store Settings or Account Settings → IPN Settings
3. Set IPN Callback URL to:
   https://your-vercel-url.vercel.app/api/ipn
4. Save

This is what automatically adds credits when a payment is confirmed.

---

## STEP 8 — TEST CHECKLIST

Run through each test before going live:

### Auth
- [ ] Go to /auth.html → sign up with a new email
- [ ] Confirmation email arrives (check spam if not)
- [ ] Click confirmation link → redirected back
- [ ] Sign in → dashboard loads with 3 credits showing ✅

### Generation
- [ ] Paste a URL (try https://stripe.com)
- [ ] Click Next → questions form appears ✅
- [ ] Fill questions → click Generate emails
- [ ] Loading steps appear (4 stages) ✅
- [ ] Signals extracted appear during loading ✅
- [ ] 3 email variants appear ✅
- [ ] Scores are DIFFERENT per variant (not all 82) ✅
- [ ] Subject lines are company-specific ✅
- [ ] Score breakdown collapses — tap to expand ✅
- [ ] Copy button works ✅
- [ ] Edit button makes email editable ✅
- [ ] Share opens sheet with X/LinkedIn/Telegram/Copy ✅
- [ ] Follow up opens slide panel ✅
- [ ] Credit count goes from 3 to 2 ✅

### History
- [ ] Go to /history.html
- [ ] Email appears in list ✅
- [ ] Click View → slide panel opens from right ✅
- [ ] Panel shows subject lines + email body ✅
- [ ] Follow up button in panel works ✅
- [ ] Edit saves correctly ✅
- [ ] Delete removes email ✅

### Payment
- [ ] Go to /pricing.html
- [ ] Click Starter plan → highlighted ✅
- [ ] Click "Pay with USDT"
- [ ] Redirected to NOWPayments payment page ✅ (like the screenshot)
- [ ] After payment → redirected back to pricing.html with success message
- [ ] Credits added within 1-3 minutes ✅

### Admin
- [ ] Login with e8318276@gmail.com → Admin link appears in nav ✅
- [ ] Login with any other email → no Admin link ✅
- [ ] Visit /admin.html with non-admin account → Access Denied ✅
- [ ] Admin panel shows stats, users table, payments table ✅

---

## PRICING

| Plan | Price | Credits |
|---|---|---|
| Free | $0 | 3 generations |
| Starter | $10 USDT/mo | 50 generations/month |
| Pro | $20 USDT/mo | 150 generations/month |
| Lifetime | $99 USDT once | Unlimited forever |

---

## FILES IN THIS ZIP

```
pitchdrop/
├── index.html          → Landing page
├── auth.html           → Login & Signup
├── dashboard.html      → Generator (2-step clean flow)
├── history.html        → Full history page
├── pricing.html        → USDT payment (NOWPayments invoice)
├── account.html        → User settings
├── admin.html          → Admin panel
├── style.css           → All styles (responsive)
├── supabase.js         → Supabase client
├── vercel.json         → Vercel config
├── package.json        → Dependencies
└── api/
    ├── generate.js     → 4-stage AI pipeline
    ├── followup.js     → Follow-up + rewrite
    ├── create-payment.js → NOWPayments invoice
    └── ipn.js          → Auto credits webhook
```

---

## TROUBLESHOOTING

| Error | Fix |
|---|---|
| Generation failed: Invalid API Key | Go to Vercel env vars → delete GROQ_API_KEY → re-add it with NO spaces → redeploy |
| NOT_FOUND on /api/generate | The api/ folder files are not in a folder — they're in root. Check GitHub repo structure. |
| Payment error: Crypto amount less than minimal | Prices are now $10/$20/$99 — this is fixed |
| Credits not adding after payment | Check SUPABASE_SERVICE_KEY is the service_role key (not anon key). Check IPN URL in NOWPayments. |
| Auth redirect not working | Add your Vercel URL to Supabase Auth → Settings → Redirect URLs |
| All scores showing same number | Old generate.js still deployed. Replace api/generate.js on GitHub → wait for redeploy |

---

## ADMIN EMAILS (hardcoded)
- e8318276@gmail.com
- bundepunemmanuel@gmail.com

Only these two emails see the Admin link and can access /admin.html
