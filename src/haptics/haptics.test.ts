import * as Haptics from 'expo-haptics';
import { haptics, setHapticsEnabled, hapticsEnabled } from './index';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const mocked = Haptics as jest.Mocked<typeof Haptics>;

beforeEach(() => {
  jest.clearAllMocks();
  setHapticsEnabled(true);
});

describe('semantic intents', () => {
  it('maps each intent to its motor pattern', () => {
    haptics.select();
    expect(mocked.selectionAsync).toHaveBeenCalledTimes(1);

    haptics.tap();
    expect(mocked.impactAsync).toHaveBeenLastCalledWith('light');

    haptics.press();
    expect(mocked.impactAsync).toHaveBeenLastCalledWith('medium');

    haptics.impact('heavy');
    expect(mocked.impactAsync).toHaveBeenLastCalledWith('heavy');

    haptics.success();
    expect(mocked.notificationAsync).toHaveBeenLastCalledWith('success');

    haptics.warning();
    expect(mocked.notificationAsync).toHaveBeenLastCalledWith('warning');

    haptics.error();
    expect(mocked.notificationAsync).toHaveBeenLastCalledWith('error');
  });

  it('defaults impact to medium', () => {
    haptics.impact();
    expect(mocked.impactAsync).toHaveBeenCalledWith('medium');
  });
});

describe('the mute switch', () => {
  it('fires nothing at all once disabled', () => {
    setHapticsEnabled(false);
    expect(hapticsEnabled()).toBe(false);

    haptics.select();
    haptics.press();
    haptics.success();
    haptics.error();

    expect(mocked.selectionAsync).not.toHaveBeenCalled();
    expect(mocked.impactAsync).not.toHaveBeenCalled();
    expect(mocked.notificationAsync).not.toHaveBeenCalled();
  });

  it('resumes when re-enabled', () => {
    setHapticsEnabled(false);
    haptics.tap();
    setHapticsEnabled(true);
    haptics.tap();
    expect(mocked.impactAsync).toHaveBeenCalledTimes(1);
  });
});

/**
 * The whole reason this is a module: a device with no haptic engine rejects
 * every call, and an unhandled rejection there would surface as a redbox over
 * something purely decorative.
 */
describe('failure is never the caller’s problem', () => {
  it('swallows a rejected promise', async () => {
    mocked.impactAsync.mockRejectedValueOnce(new Error('no haptic engine'));
    expect(() => haptics.press()).not.toThrow();
    // Let the rejection settle; an unhandled one would fail the run.
    await Promise.resolve();
  });

  it('swallows a synchronous throw', () => {
    mocked.selectionAsync.mockImplementationOnce(() => {
      throw new Error('VIBRATE permission missing');
    });
    expect(() => haptics.select()).not.toThrow();
  });
});
