import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { checkout, dodopayments, portal, usage, webhooks } from '@dodopayments/better-auth'
import DodoPayments from 'dodopayments'
import { db } from '../db'
import * as authSchema from '../db/auth-schema'
import { onCreditPurchase } from './credits'
import { CREDIT_PACKS, dodoProductIdEnvVar } from './creditPacks'

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
          // Each pack is its own one-time-purchase product in the Dodo
          // dashboard; DODO_PRODUCT_ID_CREDITS_5 / _15 / _40 / _100 must
          // point at their real product ids.
          products: CREDIT_PACKS.map((pack) => ({
            productId: process.env[dodoProductIdEnvVar(pack.slug)] ?? '',
            slug: pack.slug,
          })),
          successUrl: process.env.DODO_CHECKOUT_SUCCESS_URL ?? '/credits',
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
