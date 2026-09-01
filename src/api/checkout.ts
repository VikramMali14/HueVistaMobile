import * as WebBrowser from 'expo-web-browser';
import { billingApi, type RazorpayOrder, type VerifyPayment } from './billing';
import { aiCreditsApi, type AiCreditSummary } from './aiCredits';
import { checkoutUrl, PAY_REDIRECT_URI } from './config';
import { fragmentParams } from './fragment';
import { ApiError } from './errors';

/**
 * Paying, in the app.
 *
 * This screen used to hand the customer to the website with `Linking.openURL`
 * and consider its job done. That was not a checkout: the browser it opened had
 * no session, so someone who had just signed in on their phone was asked to sign
 * in again on a website to pay for something the app already knew the price of —
 * at the one moment in the product where an extra step costs real money. Worse,
 * nothing came back. The app never learned whether the payment happened, so the
 * room the customer had just bought did not appear until something else happened
 * to refetch.
 *
 * The flow now belongs to the app. It creates the order against its own session,
 * opens Razorpay in a browser session that closes itself on the redirect home,
 * and verifies the result — so the customer stays signed in throughout, and the
 * thing they bought is on the account before the sheet has finished closing.
 *
 * What still runs in a browser is the sheet itself, and that is deliberate:
 * Checkout is a web library, and the alternative is a payment SDK holding card
 * data on the handset. The web page it opens (`/pay/mobile` on the website)
 * decides nothing — it opens the sheet the order says to open and reports what
 * happened. Every grant is made by the backend against its own record of the
 * order, after checking the signature, so a tampered outcome buys nothing.
 */

/** Why a checkout ended without a payment. `cancelled` is not an error. */
export type CheckoutResult<T> = { status: 'paid'; result: T } | { status: 'cancelled' };

/** The website is where the sheet lives; a build with no web origin cannot pay. */
function noWebOrigin(): ApiError {
  return new ApiError({
    message:
      'This build has no website address configured, so it cannot open payment. Your paint shop can add a room to your code at the counter instead.',
    status: 503,
  });
}

/**
 * Open one Razorpay order and wait for the answer.
 *
 * Returns the signed payload on success and `null` when the customer backed out.
 * Only a refusal by the gateway throws — closing a payment sheet is an ordinary
 * thing to do and must not be reported as a failure.
 */
async function openCheckout(order: RazorpayOrder, description: string): Promise<VerifyPayment | null> {
  const url = checkoutUrl({
    order: order.orderId,
    key: order.razorpayKeyId,
    amount: order.amount,
    currency: order.currency,
    desc: description,
  });
  if (!url) throw noWebOrigin();

  const result = await WebBrowser.openAuthSessionAsync(url, PAY_REDIRECT_URI);
  // 'cancel' is the sheet swiped away, 'dismiss' the app returning without a
  // redirect. Neither is an error, and neither charged anything: Razorpay only
  // redirects once it has a payment.
  if (result.type !== 'success') return null;

  const params = fragmentParams(result.url);
  const status = params.get('status');

  if (status === 'cancelled') return null;

  if (status === 'failed') {
    throw new ApiError({
      // The gateway's own words, when it gave any. "Your card was declined" is
      // worth far more to someone standing at a counter than "payment failed".
      message: params.get('description') || 'The payment was refused. Nothing has been charged.',
      status: 402,
      code: params.get('code') ?? undefined,
    });
  }

  const orderId = params.get('order_id');
  const paymentId = params.get('payment_id');
  const signature = params.get('signature');
  if (status !== 'success' || !orderId || !paymentId || !signature) {
    throw new ApiError({ message: 'Unexpected response from the payment page.', status: 502 });
  }

  return { orderId, paymentId, signature };
}

/**
 * A charge that went through where the grant did not.
 *
 * The one outcome that must never be reported as a plain failure: the money has
 * moved. The backend has the payment on record either way — the Razorpay webhook
 * reconciles it — so the honest thing to say is that it is paid and being sorted,
 * with the payment id the customer would be asked for.
 */
function verificationFailed(paymentId: string, err: unknown): ApiError {
  const detail = err instanceof ApiError ? ` (${err.message})` : '';
  return new ApiError({
    message: `Your payment went through, but we could not confirm it on your account just yet${detail}. It usually lands within a minute. If it does not, contact support with payment ${paymentId}.`,
    status: 202,
    code: 'VERIFY_FAILED',
  });
}

/**
 * Buy one more room (or a bundle), at whatever the account's own plan charges.
 * The count is the only thing that travels out; the price comes back.
 */
export async function buyProject(credits = 1): Promise<CheckoutResult<void>> {
  const order = await billingApi.createProjectOrder(credits);
  const payment = await openCheckout(order, credits === 1 ? '1 room' : `${credits} rooms`);
  if (!payment) return { status: 'cancelled' };
  try {
    await billingApi.verifyProjectPurchase(payment);
  } catch (err) {
    throw verificationFailed(payment.paymentId, err);
  }
  return { status: 'paid', result: undefined };
}

/** Top up the AI image wallet. Resolves with the refreshed wallet. */
export async function buyAiCredits(credits: number): Promise<CheckoutResult<AiCreditSummary>> {
  const order = await aiCreditsApi.createOrder(credits);
  const payment = await openCheckout(
    order,
    credits === 1 ? '1 AI image' : `${credits} AI images`,
  );
  if (!payment) return { status: 'cancelled' };
  try {
    return { status: 'paid', result: await aiCreditsApi.verifyPurchase(payment) };
  } catch (err) {
    throw verificationFailed(payment.paymentId, err);
  }
}
