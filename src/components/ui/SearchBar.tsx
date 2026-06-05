import { Search, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search stations, lines, or trips...",
  onFocus,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={`flex-row items-center bg-surface-card rounded-2xl px-4 min-h-[48px] mb-3 border ${
        focused ? "border-brand-primary/50" : "border-surface-border"
      }`}
    >
      <Search size={18} color={focused ? "#0A84FF" : "#8E8E93"} />
      <TextInput
        className="flex-1 text-white text-[15px] ml-3 py-3 outline-none"
        placeholder={placeholder}
        placeholderTextColor="#6B6B70"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        accessibilityLabel="Search"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={12}
          accessibilityLabel="Clear search"
          className="w-8 h-8 rounded-full bg-surface-elevated items-center justify-center"
        >
          <X size={14} color="#A1A1AA" />
        </Pressable>
      ) : null}
    </View>
  );
}
