import { Alert, Platform, type AlertButton } from 'react-native';
import { confirmAction, showAlert } from '@/lib/alert';

const browser = { alert: jest.fn(), confirm: jest.fn() };

beforeAll(() => {
  Object.assign(globalThis, { window: Object.assign(globalThis.window ?? {}, browser) });
});

afterEach(() => {
  jest.restoreAllMocks();
  browser.alert.mockReset();
  browser.confirm.mockReset();
});

function pressButton(text: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as AlertButton[];
  buttons.find((b) => b.text === text)?.onPress?.();
}

describe('on native', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('showAlert uses Alert.alert', () => {
    showAlert('Error', 'Boom');
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Boom', undefined);
  });

  it('showAlert calls onDismiss when OK is pressed', () => {
    const onDismiss = jest.fn();
    showAlert('Invalid invite', 'Gone', onDismiss);
    expect(onDismiss).not.toHaveBeenCalled();
    pressButton('OK');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('confirmAction resolves true on the confirm button', async () => {
    const result = confirmAction({ title: 'Leave?', message: 'Sure?', confirmText: 'Leave', destructive: true });
    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as AlertButton[];
    expect(buttons.map((b) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Leave', 'destructive']]);
    pressButton('Leave');
    await expect(result).resolves.toBe(true);
  });

  it('confirmAction resolves false on cancel', async () => {
    const result = confirmAction({ title: 'Leave?', message: 'Sure?', confirmText: 'Leave', cancelText: 'Stay' });
    pressButton('Stay');
    await expect(result).resolves.toBe(false);
  });

  it('confirmAction resolves false when dismissed without a button', async () => {
    const result = confirmAction({ title: 'Leave?', message: 'Sure?', confirmText: 'Leave' });
    jest.mocked(Alert.alert).mock.calls[0][3]?.onDismiss?.();
    await expect(result).resolves.toBe(false);
  });
});

describe('on web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('showAlert uses window.alert and then calls onDismiss', () => {
    const onDismiss = jest.fn();
    showAlert('Error', 'Boom', onDismiss);
    expect(browser.alert).toHaveBeenCalledWith('Error\n\nBoom');
    expect(onDismiss).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('confirmAction returns what window.confirm returns', async () => {
    browser.confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(confirmAction({ title: 'A', message: 'B', confirmText: 'OK' })).resolves.toBe(true);
    await expect(confirmAction({ title: 'A', message: 'B', confirmText: 'OK' })).resolves.toBe(false);
    expect(browser.confirm).toHaveBeenCalledWith('A\n\nB');
  });
});
