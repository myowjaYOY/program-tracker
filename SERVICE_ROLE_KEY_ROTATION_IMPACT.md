# Service Role Key Rotation - Impact & Action Plan

## 🚨 CRITICAL: What Needs To Be Updated

After generating a new Supabase Service Role Key, you must update it in the following locations:

---

## ⚠️ IMMEDIATE ACTIONS REQUIRED

### 1. **Supabase Edge Functions Secrets** (CRITICAL)

**What**: Edge functions read the key from environment secrets  
**Where**: Supabase Dashboard → Project Settings → Edge Functions → Secrets  
**Command**: 
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<NEW_KEY_HERE>
```

**Affected Functions:**
- ✅ `analyze-member-progress` (3 uses)
- ✅ `process-survey-import` (3 uses) 
- ✅ `process-user-progress-import` (2 uses)

**Impact if not updated**: 
- ❌ Survey imports will fail
- ❌ Dashboard analysis will fail
- ❌ User progress imports will fail

---

### 2. **Vercel Environment Variables** (CRITICAL)

**What**: Next.js API routes read from environment variables  
**Where**: Vercel Dashboard → Project → Settings → Environment Variables  
**Variable Name**: `SUPABASE_SERVICE_ROLE_KEY`  
**Value**: Your new service role key

**Affected API Routes:**
- ✅ `/api/admin/users` - User management (1 use)
- ✅ `/api/admin/reanalyze-dashboards` - Dashboard re-analysis (1 use)

**Impact if not updated**:
- ❌ Admin user management page will break
- ❌ Dashboard re-analysis button will fail
- ❌ Cannot promote users to admin

---

### 3. **Local Development** (OPTIONAL - if you run locally)

**What**: Environment variables for local development  
**Where**: Create a `.env.local` file in project root  
**Content**:
```bash
SUPABASE_SERVICE_ROLE_KEY=<NEW_KEY_HERE>
NEXT_PUBLIC_SUPABASE_URL=https://mxktlbhiknpdauzoitnm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
```

**Affected Scripts:**
- ✅ `scripts/import-item-requests.ts`
- ✅ `scripts/check-user-admin.ts`

**Impact if not updated**:
- ❌ Local admin scripts won't work
- ❌ Manual data imports will fail
- ⚠️ **Production is NOT affected** - these are dev tools only

---

## 📊 Complete Usage Inventory

### Edge Functions (Deno Environment)
| Function | File | Line(s) | Usage |
|----------|------|---------|-------|
| analyze-member-progress | index.ts | 60 | Creates admin Supabase client |
| process-survey-import | index.ts | 191, 337, 856 | Creates admin clients for data write |
| process-user-progress-import | index.ts | 57, 432 | Creates admin clients |

### Next.js API Routes (Node Environment)
| Route | File | Line(s) | Usage |
|-------|------|---------|-------|
| /api/admin/users | route.ts | 114-115, 125 | Admin user management |
| /api/admin/reanalyze-dashboards | route.ts | 50 | Trigger dashboard analysis |

### Local Scripts (Optional)
| Script | File | Line(s) | Usage |
|--------|------|---------|-------|
| import-item-requests | import-item-requests.ts | 10 | Manual data import |
| check-user-admin | check-user-admin.ts | 10 | Check user admin status |

---

## 🔐 Step-by-Step Rotation Process

### Step 1: Generate New Key
1. Go to Supabase Dashboard
2. Project Settings → API
3. Under "Service Role Key" section
4. Click "Generate new secret"
5. **Copy the new key** (you won't see it again!)

### Step 2: Update Supabase Secrets
```bash
# Set the new key for edge functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<NEW_KEY>

# Verify it was set
supabase secrets list
```

### Step 3: Update Vercel Environment Variable
1. Go to Vercel Dashboard
2. Your Project → Settings → Environment Variables
3. Find `SUPABASE_SERVICE_ROLE_KEY`
4. Click "Edit"
5. Paste new key
6. Save
7. **Important**: May need to redeploy for changes to take effect

### Step 4: Redeploy Edge Functions (if they don't auto-update)
```bash
# Optional: Force redeploy edge functions
supabase functions deploy analyze-member-progress
supabase functions deploy process-survey-import
supabase functions deploy process-user-progress-import
```

### Step 5: Test Critical Paths
1. ✅ Import a survey CSV → Verify it processes
2. ✅ Click "Re-Analyze All" on Dashboard Analytics → Verify it works
3. ✅ Go to Admin → Users page → Verify users load
4. ✅ Check edge function logs for any auth errors

---

## ⚠️ What DOES NOT Need Updating

### Client-Side Code (Anon Key)
- ❌ **NOT AFFECTED**: Client-side code uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ❌ **NOT AFFECTED**: User authentication
- ❌ **NOT AFFECTED**: Regular data fetching

### Database Connection
- ❌ **NOT AFFECTED**: Database password
- ❌ **NOT AFFECTED**: Connection strings
- ❌ **NOT AFFECTED**: RLS policies

---

## 🔍 How to Verify It's Working

### Test 1: Edge Function Test
```bash
# Check edge function logs
supabase functions logs process-survey-import

# Should NOT see errors like:
# "Invalid JWT" or "Unauthorized"
```

### Test 2: Upload a Survey
1. Go to your admin panel
2. Upload a survey CSV
3. Check if it processes successfully
4. Verify dashboard data updates

### Test 3: Admin Page Test
1. Go to `/dashboard/admin/users`
2. Verify users list loads
3. Try updating a user permission
4. Should complete without errors

### Test 4: Dashboard Re-Analysis
1. Go to `/dashboard/admin/analytics`
2. Click "Re-Analyze All Dashboards"
3. Wait for completion
4. Verify success message

---

## ❌ Symptoms of Outdated Key

If you see any of these, the key wasn't updated properly:

### Symptoms:
- ❌ Survey imports fail silently
- ❌ "Unauthorized" errors in edge function logs
- ❌ Dashboard Analytics page shows errors
- ❌ Admin Users page fails to load
- ❌ "Invalid JWT" errors in console

### Where to Check:
```bash
# Check edge function logs
supabase functions logs --project-ref mxktlbhiknpdauzoitnm

# Check Vercel deployment logs
# Vercel Dashboard → Deployments → [Latest] → Function Logs
```

---

## 🎯 Priority Order (Do in This Sequence)

1. **FIRST**: Rotate key in Supabase Dashboard
2. **SECOND**: Update Supabase secrets (edge functions)
3. **THIRD**: Update Vercel environment variable
4. **FOURTH**: Redeploy Vercel (or wait for next auto-deploy)
5. **FIFTH**: Test critical functions
6. **LAST**: Update local .env.local (optional, dev only)

---

## 📝 Checklist

- [ ] Generated new service role key in Supabase Dashboard
- [ ] Old key revoked/disabled in Supabase
- [ ] Updated `supabase secrets` for edge functions
- [ ] Updated Vercel environment variable `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Redeployed Vercel (or triggered new deployment)
- [ ] Tested survey import functionality
- [ ] Tested dashboard re-analysis
- [ ] Tested admin users page
- [ ] Checked edge function logs for errors
- [ ] (Optional) Updated local `.env.local` for dev
- [ ] (Optional) Updated any CI/CD pipelines

---

## 🚀 Estimated Downtime

- **Supabase Secrets Update**: Instant (0 downtime)
- **Vercel Redeploy**: ~2-3 minutes
- **Total Impact**: ~5 minutes of potential issues during transition
- **Mitigation**: Update during low-traffic hours

---

## 💡 Pro Tips

1. **Keep Old Key Active**: Don't revoke immediately - update all services first
2. **Test First**: After updating, test one service before updating all
3. **Monitor Logs**: Watch edge function logs during transition
4. **Backup Plan**: Keep old key accessible for 24h in case rollback needed
5. **Document**: Save new key in secure password manager

---

## ❓ FAQ

**Q: Will users experience downtime?**  
A: Brief potential issues (~5 min) during Vercel redeploy. Plan accordingly.

**Q: Do I need to update the anon key too?**  
A: No, only the service role key was exposed. Anon key is safe.

**Q: What if I forget to update Vercel?**  
A: Admin features will break, but user-facing features remain unaffected.

**Q: How often should I rotate this key?**  
A: After any exposure, or every 90 days as security best practice.

**Q: Can I test the new key before revoking old one?**  
A: Yes! Update all services, test, then revoke old key once confident.

---

## 🆘 Emergency Rollback

If something breaks after rotation:

```bash
# Restore old key temporarily
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<OLD_KEY>

# In Vercel: Revert environment variable to old key

# Fix the issue, then rotate again properly
```

---

**BOTTOM LINE**: You need to update **2 critical locations**:
1. ✅ **Supabase Secrets** (for edge functions)
2. ✅ **Vercel Environment Variables** (for Next.js API routes)

Everything else is optional or automatic.

