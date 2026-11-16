import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { searchAddress, type AddressSuggestion } from '@/utils/searchAddress';
import { colors, radii } from '@/lib/theme';

const DEBOUNCE_MS = 300;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
}

export function AddressAutocomplete({ value, onChangeText, onSelect, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChangeText(text: string) {
    onChangeText(text);
    setShowDropdown(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    timerRef.current = setTimeout(async () => {
      const results = await searchAddress(text);
      setSuggestions(results);
      setIsSearching(false);
      setHasSearched(true);
    }, DEBOUNCE_MS);
  }

  function handleSelect(suggestion: AddressSuggestion) {
    onSelect(suggestion);
    setSuggestions([]);
    setShowDropdown(false);
    setHasSearched(false);
  }

  const dropdownVisible = showDropdown && (isSearching || suggestions.length > 0 || hasSearched);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder={placeholder ?? 'Search for an address…'}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Address search"
      />

      {dropdownVisible && (
        <View style={styles.dropdown}>
          {isSearching ? (
            <View style={styles.dropdownRow}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : suggestions.length > 0 ? (
            suggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.latitude}-${s.longitude}-${i}`}
                style={styles.dropdownRow}
                onPress={() => handleSelect(s)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>{s.label}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.dropdownRow}>
              <Text style={styles.dropdownEmptyText}>No addresses found — try a different search</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dropdownRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownText: { fontSize: 14, color: colors.text },
  dropdownEmptyText: { fontSize: 13, color: colors.textTertiary },
});
