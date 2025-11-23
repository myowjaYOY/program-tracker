# Pre-Production Deployment Checklist

**Last Updated:** 2025-11-05  
**Purpose:** Standard operating procedure to minimize deployment risk before pushing to production.

---

## Prerequisites (Assumed Complete)
- ✅ Manual testing and QA completed
- ✅ Database backups verified
- ✅ Rollback procedure documented

---

## 1. Pre-Flight Checks (Code Quality)

### Linter & Type Checking
```bash
# Run ESLint check
npm run lint

# If errors found, fix them
npm run lint -- --fix

# TypeScript compilation check
npx tsc --noEmit
```

**Action Items:**
- [ ] Zero linter errors
- [ ] Zero TypeScript errors
- [ ] All auto-fixable issues resolved

### Code Cleanup
**Search for and remove/fix:**
- [ ] `console.log` statements (except intentional logging)
- [ ] `console.error` statements (should use proper error handling)
- [ ] `debugger` statements
- [ ] Large blocks of commented-out code
- [ ] `// TODO` comments that should be addressed
- [ ] `// FIXME` comments
- [ ] Hardcoded values (URLs, IDs, test data)

**Commands to help find issues:**
```bash
# Find console statements
grep -r "console\." --include="*.ts" --include="*.tsx" src/

# Find debugger statements
grep -r "debugger" --include="*.ts" --include="*.tsx" src/

# Find TODO/FIXME
grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" src/
```

---

## 2. Build Verification

### Production Build Test
```bash
# Clean previous builds
rm -rf .next

# Run production build
npm run build
```

**Action Items:**
- [ ] Build completes successfully (exit code 0)
- [ ] No TypeScript errors in build output
- [ ] No critical webpack/Next.js warnings
- [ ] Bundle size warnings reviewed (if any)
- [ ] Route generation completed for all pages

### Build Output Review
Check `.next/` build output:
- [ ] All routes compiled successfully
- [ ] Static pages generated correctly
- [ ] API routes included
- [ ] No missing imports or modules

### Local Production Test (Optional but Recommended)
```bash
# Start production build locally
npm run start

# Test in browser at http://localhost:3000
```

**Critical Routes to Verify:**
- [ ] `/dashboard` - Dashboard loads
- [ ] `/dashboard/programs` - Programs page loads
- [ ] `/dashboard/report-card` - Report Card loads
- [ ] Authentication flow works
- [ ] API routes respond correctly

---

## 3. Database & Schema Review

### Check for Pending Migrations
```bash
# List all migrations (via MCP Supabase)
# Check if there are any unapplied migrations
```

**Via AI Assistant with MCP:**
- [ ] Run `mcp_supabase_list_migrations` to verify migration state
- [ ] Confirm all expected migrations are applied
- [ ] No orphaned or failed migrations

### Database Advisor Checks
**Security Advisors:**
- [ ] Run `mcp_supabase_get_advisors` with type: "security"
- [ ] Review all security findings
- [ ] Verify RLS policies are in place for new tables
- [ ] Check for tables missing security policies

**Performance Advisors:**
- [ ] Run `mcp_supabase_get_advisors` with type: "performance"
- [ ] Review all performance findings
- [ ] Check for missing indexes on foreign keys
- [ ] Verify query performance is acceptable

### Schema Validation
- [ ] All new tables have `created_at`, `updated_at`, `active_flag`
- [ ] All new tables have proper `created_by`, `updated_by` audit fields
- [ ] Foreign key constraints are in place
- [ ] Cascading deletes are intentional and safe
- [ ] Enum types are updated if needed

---

## 4. Code Review & Git Hygiene

### Review All Changes
```bash
# See all changed files
git status

# Review all diffs
git diff

# Review staged changes
git diff --staged
```

**Action Items:**
- [ ] Review every changed file
- [ ] Verify no unintended changes
- [ ] Check for debug code left in
- [ ] Verify imports are correct
- [ ] Check for unused imports

### Sensitive Data Check
```bash
# Check for potential secrets
git diff | grep -i "password\|secret\|key\|token"

# Check for .env files
git status | grep ".env"

# Check for hardcoded credentials
grep -r "password.*=.*['\"]" --include="*.ts" --include="*.tsx" src/
```

**Action Items:**
- [ ] No `.env` files in commits
- [ ] No API keys hardcoded
- [ ] No passwords in code
- [ ] No database connection strings
- [ ] No personal identifiable information (PII)
- [ ] `.gitignore` is up to date

### File-Specific Checks
**Files that should NEVER be committed:**
- [ ] `.env.local`
- [ ] `.env.production`
- [ ] `node_modules/` (should be in .gitignore)
- [ ] `.next/` (should be in .gitignore)
- [ ] `*.log` files
- [ ] IDE-specific files (`.vscode/`, `.idea/`)

---

## 5. Dependencies & Security

### Dependency Check
```bash
# Check for outdated packages
npm outdated

# Check for security vulnerabilities
npm audit

# For critical/high vulnerabilities
npm audit --audit-level=high
```

**Action Items:**
- [ ] Review outdated packages
- [ ] No critical security vulnerabilities
- [ ] No high-severity vulnerabilities (or documented exceptions)
- [ ] `package-lock.json` is committed if dependencies changed
- [ ] All dependency updates are intentional

### Package.json Review
- [ ] Version numbers are correct
- [ ] No `^` or `~` for critical packages (if strict versioning needed)
- [ ] Scripts are correct and tested
- [ ] Peer dependencies are satisfied

---

## 6. Environment & Configuration

### Environment Variables Verification
**Check `.env.example` is up to date:**
- [ ] All required environment variables documented
- [ ] No secret values in `.env.example`
- [ ] Comments explain what each variable is for

**Production Environment Check:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set correctly
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set correctly (server-side only)
- [ ] `NPM_TOKEN` is set (for MUI Pro)
- [ ] Any new environment variables are set in production

### Configuration Files
- [ ] `next.config.js` - Review for production settings
- [ ] `.npmrc` - MUI Pro token configured
- [ ] `tsconfig.json` - No development-only settings
- [ ] `tailwind.config.ts` - All used components included

---

## 7. Component & Feature Verification

### New Features Checklist
For each new feature or component:
- [ ] Follows established architecture patterns (BaseForm, BaseDataTable)
- [ ] Uses TypeScript strict mode (no `any` types)
- [ ] Proper error handling with user-friendly messages
- [ ] Loading states implemented (Skeleton components)
- [ ] Uses theme values (no hardcoded colors)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility considerations (ARIA labels, keyboard navigation)

### Material UI Specific
- [ ] All MUI components use `sx` prop (not inline styles)
- [ ] Uses `theme.spacing()` for all spacing
- [ ] Color palette uses theme colors (primary, secondary, etc.)
- [ ] DataGrid Pro version matches package.json (v8.6+)

### API Routes
- [ ] All API routes have authentication checks
- [ ] Input validation with Zod schemas
- [ ] Proper HTTP status codes returned
- [ ] Error responses are consistent
- [ ] CORS configured correctly (if needed)

---

## 8. Documentation Updates

### Update Documentation (if applicable)
- [ ] README.md updated for major features
- [ ] `docs/` folder updated with new features
- [ ] API documentation updated
- [ ] Breaking changes documented
- [ ] Migration guides written (if needed)

### Inline Documentation
- [ ] Complex functions have JSDoc comments
- [ ] Interfaces/types are documented
- [ ] Business logic is explained
- [ ] Non-obvious code has comments

---

## 9. Final Pre-Push Checklist

### One Last Review
- [ ] Re-run linter: `npm run lint`
- [ ] Re-run type check: `npx tsc --noEmit`
- [ ] Re-run build: `npm run build`
- [ ] All above sections completed

### Git Commit Preparation
```bash
# Review what will be committed
git status
git diff --staged

# Ensure clean working directory
git add .
```

**Commit Message Format:**
- [ ] Use conventional commit format: `feat:`, `fix:`, `chore:`, `docs:`
- [ ] Keep under 50 characters
- [ ] Be specific about what changed
- [ ] Reference issue/ticket numbers if applicable

**Examples:**
- ✅ `feat: add PROMIS-29 report export with PDF generation`
- ✅ `fix: correct margin calculation for active programs`
- ✅ `chore: update MUI to v8.6 and fix breaking changes`
- ❌ `update stuff` (too vague)
- ❌ `fixed bug` (not specific)

---

## 10. Post-Deployment Validation (After Deploy)

### Immediate Checks (Within 5 minutes)
- [ ] Production site loads successfully
- [ ] Homepage renders correctly
- [ ] Dashboard accessible
- [ ] Authentication works
- [ ] No console errors in browser
- [ ] Check production error logs (Vercel/hosting dashboard)

### Critical Path Testing (Within 15 minutes)
- [ ] User can log in
- [ ] User can navigate to main pages
- [ ] Data loads correctly from database
- [ ] Forms submit successfully
- [ ] Reports generate (if report-related changes)
- [ ] No 500 errors on any route

### Monitoring
- [ ] Check Vercel/hosting platform for deployment status
- [ ] Monitor Supabase logs for database errors
- [ ] Watch for user-reported issues
- [ ] Check API response times

---

## Emergency Rollback Procedure

**If critical issues are found post-deployment:**

1. **Immediate Rollback (Vercel):**
   - Go to Vercel Dashboard → Deployments
   - Find previous stable deployment
   - Click "..." → "Promote to Production"

2. **Database Rollback (if migration was deployed):**
   - Use Supabase Dashboard → Database → Migrations
   - Manually revert migration if needed
   - Or restore from backup

3. **Notify Team:**
   - Document what went wrong
   - Create incident report
   - Plan hotfix if needed

---

## Notes & Best Practices

### When to Skip Steps
- **Hotfix:** For critical bugs, you may skip some checks but ALWAYS run linter and build
- **Copy Changes:** For documentation-only changes, build verification can be skipped
- **Config Changes:** Always do full verification for any config/env changes

### When to Do Extra Steps
- **Database Changes:** Always run advisor checks and verify RLS policies
- **Authentication Changes:** Test thoroughly on staging first
- **Payment/Financial Logic:** Never skip testing, always test on staging
- **Report Generation:** Test with real data, verify PDF output

### Project-Specific Reminders
- **Memory [[10137092]]:** NEVER run `git commit` or `git push` unless explicitly requested
- **Memory [[10555261]]:** ALWAYS get permission before executing SQL UPDATE/DELETE/INSERT
- **Memory [[10814301]]:** Use MCP Supabase tools for database access, not `npx supabase` CLI
- **Read-Only Programs:** Test that Completed/Cancelled/Lost programs remain locked
- **Financial Calculations:** Verify margin and variance calculations after any program finance changes

---

## Checklist Version History

- **v1.0** - 2025-11-05: Initial version created
- _Future updates will be logged here_

---

## Quick Reference Commands

```bash
# Full pre-deployment check (run all at once)
npm run lint && npx tsc --noEmit && npm run build

# Find potential issues
grep -r "console\." --include="*.ts" --include="*.tsx" src/
grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" src/

# Security check
npm audit --audit-level=high

# Review changes
git status && git diff
```

---

**When user says "Let's go to prod":**
1. Start at Section 1 and work through each section
2. Check off each item as you complete it
3. Report any blockers or issues immediately
4. Only proceed to deployment when ALL items are checked
5. User will handle Section 9 (Deployment Execution) manually
















