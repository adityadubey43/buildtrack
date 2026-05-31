# Razorpay Monthly Subscription Fix

## Problem Resolved

**Error:** "Your payment was not successful as the seller does not support recurring payments"

This was caused by incorrect subscription configuration in both backend and frontend code.

---

## What Was Fixed

### 1. **Backend: razorpayController.js**

- ✅ Removed invalid `quantity: 1` parameter from subscription creation
- ✅ Changed `total_count` from 120 to 0 (unlimited renewals)
- ✅ Updated plan ID environment variable names to include `_MONTHLY` suffix
- ✅ Updated health check to validate correct env vars

### 2. **Frontend: signup/page.tsx**

- ✅ Added `method: { emandate: 1 }` to enable e-mandate for recurring payments
- ✅ Added validation for subscription ID reception
- ✅ Improved error messaging

### 3. **Plan Configuration**

- ✅ Updated plan creation script to use `RAZORPAY_PLAN_*_MONTHLY` and `RAZORPAY_PLAN_*_YEARLY`

---

## Setup Instructions (Required!)

### Step 1: Recreate Razorpay Plans

You need to recreate your subscription plans in Razorpay with the corrected configuration.

**Run this command:**

```bash
cd backend
node scripts/createRazorpayPlans.js
```

**Expected output:**

```
Creating Razorpay plans (TEST mode)...

✅ BuildTrack Basic (Monthly)
   Plan ID : plan_xxxxxxxxxxxxx
   Amount  : ₹999/monthly

✅ BuildTrack Pro (Monthly)
   Plan ID : plan_yyyyyyyyyyyyy
   Amount  : ₹2499/monthly

✅ BuildTrack Enterprise (Monthly)
   Plan ID : plan_zzzzzzzzzzzzz
   Amount  : ₹4999/monthly

✅ BuildTrack Basic (Yearly)
   Plan ID : plan_wwwwwwwwwwwww
   Amount  : ₹10789/yearly

... (and so on for all plans)
```

### Step 2: Update .env File

Copy the output from Step 1 and add it to your `.backend/.env` file:

```env
# Replace these with the Plan IDs from Step 1
RAZORPAY_PLAN_BASIC_MONTHLY=plan_xxxxxxxxxxxxx
RAZORPAY_PLAN_PRO_MONTHLY=plan_yyyyyyyyyyyyy
RAZORPAY_PLAN_ENTERPRISE_MONTHLY=plan_zzzzzzzzzzzzz

RAZORPAY_PLAN_BASIC_YEARLY=plan_wwwwwwwwwwwww
RAZORPAY_PLAN_PRO_YEARLY=plan_vvvvvvvvvvvvv
RAZORPAY_PLAN_ENTERPRISE_YEARLY=plan_uuuuuuuuuuuuu

# Keep your existing variables
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

### Step 3: Restart Backend Server

```bash
cd backend
npm start
# or if using a process manager: pm2 restart <app-name>
```

### Step 4: Verify Configuration

Check that the health endpoint returns success:

```bash
curl https://your-api-url/api/razorpay/health
```

Expected response:

```json
{
  "success": true,
  "keyId": "rzp_test_xxxxx...",
  "mode": "test"
}
```

---

## How It Works Now

### Monthly Subscription Flow:

1. User selects "Monthly" billing and plan on signup page
2. Frontend calls `/api/razorpay/create-subscription`
3. Backend creates a subscription object on Razorpay (no charge yet)
4. Razorpay Checkout opens with e-mandate option
5. User authorizes the payment method (card/UPI/etc.)
6. Razorpay processes the first charge automatically
7. Backend verifies and creates tenant + user account

### Key Improvements:

- ✅ **E-mandate support** - Users can authorize recurring payments
- ✅ **Correct subscription parameters** - No more invalid `quantity` field
- ✅ **Unlimited renewals** - `total_count: 0` allows infinite monthly charges
- ✅ **Better error handling** - Clearer error messages for debugging

---

## Troubleshooting

### "Missing monthly plan in env"

- Run `node scripts/createRazorpayPlans.js` again
- Copy all `RAZORPAY_PLAN_*_MONTHLY` variables to `.env`
- Restart backend server

### "Payment verification failed"

- Check that subscription ID is being received from Razorpay
- Verify `.env` has correct `RAZORPAY_KEY_SECRET`
- Check backend logs for detailed error messages

### "Subscription is not authorised yet"

- User may have cancelled the mandate authorization
- Subscription status needs to be "authenticated" or "active"
- Check Razorpay dashboard for subscription status

### "Cannot set properties of undefined"

- Ensure `.env` file has all required `RAZORPAY_PLAN_*_MONTHLY` variables
- Restart backend after updating `.env`
- Clear browser cache and try again

---

## Testing Checklist

- [ ] Recreated plans using `createRazorpayPlans.js`
- [ ] Updated `.env` with new plan IDs
- [ ] Restarted backend server
- [ ] Health endpoint returns `success: true`
- [ ] Can load signup page without errors
- [ ] Monthly plan selection works
- [ ] Razorpay Checkout opens with subscription_id
- [ ] Payment authorization completes
- [ ] Account is created after payment
- [ ] Tenant appears in database with active subscription

---

## Files Modified

1. `backend/src/controllers/razorpayController.js`
   - Fixed subscription creation parameters
   - Updated plan ID env var names

2. `ac-saas/src/app/signup/page.tsx`
   - Added e-mandate support
   - Improved error handling

3. `backend/scripts/createRazorpayPlans.js`
   - Already configured with correct env var names

---

## Support

If issues persist:

1. Check backend logs: `docker logs <container_name>` or terminal output
2. Verify plan IDs in Razorpay dashboard: razorpay.com/dashboard
3. Ensure all `RAZORPAY_PLAN_*_MONTHLY` vars are in `.env`
4. Check that subscription status is "created" or "authenticated" in Razorpay
