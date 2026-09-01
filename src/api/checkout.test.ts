import * as WebBrowser from 'expo-web-browser';
import { buyProject, buyAiCredits } from './checkout';
import { billingApi } from './billing';
import { aiCreditsApi } from './aiCredits';
import { ApiError } from './errors';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

// The website origin decides whether there is a sheet to open at all, and it is
// read at module load, so it has to be set before `config` is first imported.
jest.mock('./config', () => ({
  ...jest.requireActual('./config'),
  checkoutUrl: (p: Record<string, unknown>) =>
    `https://huevista.org/pay/mobile?order=${p.order}&amount=${p.amount}`,
  PAY_REDIRECT_URI: 'huevista://pay/callback',
}));

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;

const ORDER = {
  orderId: 'order_ABC123',
  amount: 19900,
  currency: 'INR',
  razorpayKeyId: 'rzp_test_key',
  pricingPlan: 'FREE',
};

/** What the checkout page hands back on the redirect, as a fragment. */
function redirect(fragment: string) {
  openAuthSession.mockResolvedValue({ type: 'success', url: `huevista://pay/callback#${fragment}` });
}

beforeEach(() => {
  jest.restoreAllMocks();
  openAuthSession.mockReset();
  jest.spyOn(billingApi, 'createProjectOrder').mockResolvedValue(ORDER);
  jest.spyOn(billingApi, 'verifyProjectPurchase').mockResolvedValue(undefined);
});

describe('buyProject', () => {
  it('verifies the signed result and reports the room as paid', async () => {
    redirect('status=success&order_id=order_ABC123&payment_id=pay_XYZ&signature=sig_1');

    await expect(buyProject()).resolves.toEqual({ status: 'paid', result: undefined });

    // The signature must reach the backend exactly as the gateway gave it —
    // this is the whole of what makes the grant safe.
    expect(billingApi.verifyProjectPurchase).toHaveBeenCalledWith({
      orderId: 'order_ABC123',
      paymentId: 'pay_XYZ',
      signature: 'sig_1',
    });
  });

  it('treats a closed sheet as a cancellation, not a failure', async () => {
    // 'dismiss' is the app coming back with no redirect at all: the customer
    // swiped the browser away. Nothing was charged, so nothing is wrong.
    openAuthSession.mockResolvedValue({ type: 'dismiss' });

    await expect(buyProject()).resolves.toEqual({ status: 'cancelled' });
    expect(billingApi.verifyProjectPurchase).not.toHaveBeenCalled();
  });

  it('treats an explicitly cancelled checkout as a cancellation', async () => {
    redirect('status=cancelled');

    await expect(buyProject()).resolves.toEqual({ status: 'cancelled' });
    expect(billingApi.verifyProjectPurchase).not.toHaveBeenCalled();
  });

  it('passes the gateway’s own words through on a refusal', async () => {
    redirect('status=failed&code=BAD_REQUEST_ERROR&description=Your%20card%20was%20declined');

    // "Your card was declined" is worth far more at a counter than "payment failed".
    await expect(buyProject()).rejects.toThrow('Your card was declined');
    expect(billingApi.verifyProjectPurchase).not.toHaveBeenCalled();
  });

  it('refuses a success that is missing its signature', async () => {
    redirect('status=success&order_id=order_ABC123&payment_id=pay_XYZ');

    await expect(buyProject()).rejects.toThrow(/Unexpected response/);
    expect(billingApi.verifyProjectPurchase).not.toHaveBeenCalled();
  });

  it('never reports a charged payment as a plain failure', async () => {
    redirect('status=success&order_id=order_ABC123&payment_id=pay_XYZ&signature=sig_1');
    jest
      .spyOn(billingApi, 'verifyProjectPurchase')
      .mockRejectedValue(new ApiError({ message: 'Gateway timeout', status: 504 }));

    // The money moved. The customer must be told that, and given the id they
    // would be asked for — not "something went wrong".
    const err = await buyProject().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('VERIFY_FAILED');
    expect((err as ApiError).message).toContain('went through');
    expect((err as ApiError).message).toContain('pay_XYZ');
  });
});

describe('buyAiCredits', () => {
  it('orders the count asked for and returns the refreshed wallet', async () => {
    const wallet = { balance: 12 } as Awaited<ReturnType<typeof aiCreditsApi.verifyPurchase>>;
    jest.spyOn(aiCreditsApi, 'createOrder').mockResolvedValue({ ...ORDER, amount: 21000 });
    jest.spyOn(aiCreditsApi, 'verifyPurchase').mockResolvedValue(wallet);
    redirect('status=success&order_id=order_ABC123&payment_id=pay_XYZ&signature=sig_1');

    await expect(buyAiCredits(3)).resolves.toEqual({ status: 'paid', result: wallet });

    // Only the count travels out. The amount is the server's to decide, so a
    // stale price on screen can never become a stale price charged.
    expect(aiCreditsApi.createOrder).toHaveBeenCalledWith(3);
  });
});
