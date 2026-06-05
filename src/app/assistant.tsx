import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import { FEATURES } from "../constants/features";
import { ChevronLeft, Clock, MapPin, Mic, Navigation, Send, Sparkles } from "lucide-react-native";
import { Txt } from "../components/design";
import { interFamily } from "../constants/design";
import { useColors } from "../hooks/useColors";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { askAssistant, type AssistantContext } from "../services/aiService";
import { useStore } from "../store/store";

interface Msg {
  id: string;
  role: "ai" | "user";
  text: string;
}

const INITIAL: Msg = {
  id: "m0",
  role: "ai",
  text: "Hi! I'm your Sydney Transit AI. I can help you plan journeys, find stations, check live departures, and answer anything about Sydney's transport network.",
};

const SUGGESTIONS = [
  { icon: MapPin, color: "#0051C3", text: "Fastest route to Opera House" },
  { icon: Clock, color: "#34C759", text: "Next train from Central" },
  { icon: Navigation, color: "#6F2C91", text: "Stations within 500m of me" },
  { icon: Sparkles, color: "#FF9500", text: "Weekend trip to Manly" },
];

const DEFAULT_LOCATION = { lat: -33.883, lng: 151.2063 };

/** Render **bold** spans inside an AI bubble. */
function RichText({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Txt size={13} color={color} lineHeight={19}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <Txt key={i} size={13} weight="700" color={color}>
            {p.slice(2, -2)}
          </Txt>
        ) : (
          p
        )
      )}
    </Txt>
  );
}

function TypingDots() {
  const c = useColors();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: -4, duration: 250, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(300 - i * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingVertical: 4 }}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.textSecondary, transform: [{ translateY: d }] }}
        />
      ))}
    </View>
  );
}

function Avatar() {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#6F2C91", alignItems: "center", justifyContent: "center" }}>
      <Sparkles size={14} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}

export default function AssistantScreen() {
  const c = useColors();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const userLocation = useStore((s) => s.userLocation);
  const favorites = useStore((s) => s.favorites);
  const alerts = useStore((s) => s.alerts);
  const { data: backendStatus } = useBackendStatus();

  const [messages, setMessages] = useState<Msg[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const buildContext = useCallback((): AssistantContext => {
    return {
      userLocation: userLocation ?? DEFAULT_LOCATION,
      favorites,
      recentAlerts: alerts ?? [],
      currentTime: new Date(),
    };
  }, [userLocation, favorites, alerts]);

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || sending) return;

      setSending(true);
      setInput("");
      setStatusHint(null);

      const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text: value };
      const history = messages.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      }));

      setMessages((m) => [...m, userMsg]);
      setTyping(true);

      const aiId = `a${Date.now()}`;
      let streamStarted = false;

      try {
        const result = await askAssistant(value, buildContext(), history, {
          onStatus: (s) => setStatusHint(s),
          onDelta:
            Platform.OS === "web"
              ? (_chunk, full) => {
                  if (!full) return;
                  if (!streamStarted) {
                    streamStarted = true;
                    setTyping(false);
                    setMessages((m) => [...m, { id: aiId, role: "ai", text: full }]);
                  } else {
                    setMessages((m) => m.map((msg) => (msg.id === aiId ? { ...msg, text: full } : msg)));
                  }
                }
              : undefined,
        });

        if (!streamStarted) {
          setTyping(false);
          setMessages((m) => [...m, { id: aiId, role: "ai", text: result.text }]);
        } else {
          setMessages((m) => m.map((msg) => (msg.id === aiId ? { ...msg, text: result.text } : msg)));
        }
      } catch {
        setTyping(false);
        setMessages((m) => [
          ...m,
          {
            id: aiId,
            role: "ai",
            text: "Sorry, I couldn't reach the transit AI service. Make sure the backend is running (`npm run dev`) and try again.",
          },
        ]);
      } finally {
        setSending(false);
        setStatusHint(null);
      }
    },
    [sending, messages, buildContext]
  );

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, typing]);

  const liveLabel = backendStatus?.tfnswLive
    ? "Live TfNSW data"
    : backendStatus?.ok
      ? "Connected to backend"
      : "Offline — limited answers";

  if (!FEATURES.assistant) {
    return <Redirect href="/(tabs)/journey" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient
        colors={["#4a1480", "#6F2C91", "#5a2d82"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ paddingTop: Math.max(insets.top, 12) + 4, paddingHorizontal: 16, paddingBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={goBack}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt size={18} weight="700" color="#FFFFFF">
              AI Transit
            </Txt>
            <Txt size={12} color="rgba(255,255,255,0.6)">
              {statusHint ?? liveLabel}
            </Txt>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={18} color="#FFFFFF" strokeWidth={2.2} />
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: c.bg }}
          contentContainerStyle={{ padding: 20, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) =>
            m.role === "ai" ? (
              <View key={m.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <Avatar />
                <View
                  style={{
                    flexShrink: 1,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 18,
                    borderBottomLeftRadius: 5,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    maxWidth: "85%",
                  }}
                >
                  {m.text ? <RichText text={m.text} color={c.text} /> : null}
                </View>
              </View>
            ) : (
              <View key={m.id} style={{ alignItems: "flex-end" }}>
                <View
                  style={{
                    backgroundColor: c.primary,
                    borderRadius: 18,
                    borderBottomRightRadius: 5,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    maxWidth: "85%",
                  }}
                >
                  <Txt size={13} color="#FFFFFF" lineHeight={19}>
                    {m.text}
                  </Txt>
                </View>
              </View>
            )
          )}

          {typing ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <Avatar />
              <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, borderBottomLeftRadius: 5, paddingHorizontal: 14 }}>
                <TypingDots />
              </View>
            </View>
          ) : null}

          {messages.length === 1 && !typing && !sending ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <Pressable
                    key={s.text}
                    onPress={() => send(s.text)}
                    disabled={sending}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: 16,
                      padding: 12,
                      opacity: sending ? 0.5 : 1,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${s.color}1A`, alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} color={s.color} strokeWidth={2.2} />
                    </View>
                    <Txt size={13} weight="500" color={c.text}>
                      {s.text}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: c.card,
            borderTopWidth: 1,
            borderTopColor: c.border,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: c.muted, borderRadius: 16, paddingHorizontal: 16 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about Sydney transport…"
              placeholderTextColor={c.textSecondary}
              editable={!sending}
              onSubmitEditing={() => send(input)}
              style={{ flex: 1, fontFamily: interFamily("400"), fontSize: 13, color: c.text, paddingVertical: 12 }}
            />
            <Mic size={18} color={c.textSecondary} strokeWidth={2} />
          </View>
          <Pressable
            disabled={!input.trim() || sending}
            onPress={() => send(input)}
            style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", opacity: input.trim() && !sending ? 1 : 0.35 }}
          >
            <Send size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
