import { render, screen, fireEvent } from '@testing-library/react-native';
import { LoadError } from '@/components/LoadError';

describe('LoadError', () => {
  it('says what failed and retries on tap', async () => {
    const onRetry = jest.fn();
    await render(<LoadError what="your pings" onRetry={onRetry} />);
    expect(screen.getByText("Couldn't load your pings")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
