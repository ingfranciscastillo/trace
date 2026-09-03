import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { checkout, dodopayments, portal, usage, webhooks } from '@dodopayments/better-auth'
import DodoPayments from 'dodopayments'
import { db } from '../db'
import * as authSchema from '../db/auth-schema'
import { onCreditPurchase } from './credits'

// Constructing the DodoPayments client throws synchronously if no API key is
// set — and auth.ts is loaded eagerly by everything (login, every trace via
// usageLimits, the whole app). Without this guard, an unconfigured Dodo key
// would take the entire app down, not just credit purchases.
const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY
const dodoPaymentsPlugin = dodoApiKey
  ? dodopayments({
      client: new DodoPayments({
        bearerToken: dodoApiKey,
        environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
      }),
      createCustomerOnSignUp: true,
      getCustomerParams: (user) => ({
        metadata: { better_auth_user_id: user.id },
      }),
      use: [
        checkout({
          products: [
            // Configured in the Dodo dashboard as a one-time-purchase product;
            // DODO_CREDITS_PACK_PRODUCT_ID must point at its real product id.
            { productId: process.env.DODO_CREDITS_PACK_PRODUCT_ID ?? '', slug: 'credits-5' },
          ],
          successUrl: process.env.DODO_CHECKOUT_SUCCESS_URL ?? '/',
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        webhooks({
          webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? '',
          onPayload: onCreditPurchase,
        }),
      ],
    })
  : undefined

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Only better-auth's own endpoints (sign-in, sign-up, etc.) — the endpoints
  // that actually spend money (Brave/Firecrawl) have their own separate quota
  // system in src/lib/usageLimits.ts, since this doesn't cover custom server
  // functions at all.
  rateLimit: {
    enabled: true,
    storage: 'database',
  },
  plugins: [tanstackStartCookies(), ...(dodoPaymentsPlugin ? [dodoPaymentsPlugin] : [])],
})
