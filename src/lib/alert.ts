import { Alert, Platform } from 'react-native';

// Alert.alert is a no-op in react-native-web, so web falls back to the
// browser's own dialogs.

export function showAlert(title: string, message?: string, onDismiss?: () => void): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    onDismiss?.();
    return;
  }
  Alert.alert(title, message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
}

export function confirmAction(options: {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmText, cancelText = 'Cancel', destructive = false } = options;
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      // Android: tapping outside the dialog dismisses it without a button press.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
