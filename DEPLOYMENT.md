# Canoe Organizer Deployment Guide

## Quick Deploy (Recommended)

### Option 1: Vercel Web UI (Easiest)
1. Go to https://vercel.com/new
2. Import GitHub repo: `mini-unspacy/canoe-organizer`
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - Name: `VITE_CONVEX_URL`
   - Value: Your Convex URL
5. Click **Deploy**

### Option 2: Vercel CLI
```bash
# Login (one time)
vercel login

# Deploy to production
vercel --prod
```

## Dual Environment Setup (Dev + Prod)

### Step 1: Deploy Convex Prod
```bash
cd /Users/yammy1688/.openclaw/workspace-coder/canoe
npx convex deploy
# Copy the production URL from output
```

### Step 2: Create Vercel Projects

**Production Project:**
```bash
vercel --prod --token=$VERCEL_TOKEN
# Set VITE_CONVEX_URL to your PROD Convex URL
```

**Development Project:**
```bash
# Create separate project for dev
vercel --target=preview
# Set VITE_CONVEX_URL to your DEV Convex URL
```

### Step 3: Environment Variables

| Project | VITE_CONVEX_URL |
|---------|-----------------|
| Production | `https://your-prod.convex.cloud` |
| Development | `https://effervescent-dachshund-428.convex.cloud` |

## GitHub Repo
https://github.com/mini-unspacy/canoe-organizer
