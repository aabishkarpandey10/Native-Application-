import { Redirect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Train,
} from "lucide-react-native";
import { AdminConfigForm } from "../../components/admin/AdminConfigForm";
import { AdminLogoPanel } from "../../components/admin/AdminLogoPanel";
import { AdminNetworkMapPanel } from "../../components/admin/AdminNetworkMapPanel";
import { AdminSwitch } from "../../components/admin/AdminFields";
import { AdminSegmentTabs, AdminStatRow } from "../../components/admin/AdminSegmentTabs";
import type { AppConfig } from "../../types/appConfig";
import { normalizeAppConfig } from "../../types/appConfig";
import { BackButton, GroupedList, SectionHeader, Txt } from "../../components/design";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { FEATURES } from "../../constants/features";
import { MIN_TOUCH, SPACING, resolveTextStyle } from "../../constants/design";
import { getStackContentClearance } from "../../constants/layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keyboardAvoidingBehavior } from "../../utils/keyboard";
import { useColors } from "../../hooks/useColors";
import { useSafeBack } from "../../hooks/useSafeBack";
import {
  adminGetData,
  adminLogin,
  adminLogout,
  adminResetDefaults,
  adminSaveAlerts,
  adminSaveAppConfig,
  adminSaveStations,
  type AdminAlert,
  type AdminStation,
} from "../../services/adminApi";

type Tab = "config" | "map" | "stations" | "alerts";

const TABS: { key: Tab; label: string }[] = [
  { key: "config", label: "App" },
  { key: "map", label: "Map" },
  { key: "stations", label: "Stations" },
  { key: "alerts", label: "Alerts" },
];

export default function AdminScreen() {
  const c = useColors();
  const goBack = useSafeBack();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("config");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [stations, setStations] = useState<AdminStation[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [expandedStation, setExpandedStation] = useState<string | null>(null);

  const filteredStations = useMemo(() => {
    const q = stationSearch.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q)
    );
  }, [stations, stationSearch]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetData();
      setConfig(normalizeAppConfig(data.appConfig));
      setStations(data.stations);
      setAlerts(data.alerts);
      setUpdatedAt(data.updatedAt);
      setLoggedIn(true);
    } catch {
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const invalidateApp = () => {
    void queryClient.invalidateQueries({ queryKey: ["appConfig"] });
    void queryClient.invalidateQueries({ queryKey: ["stations"] });
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nearbyStops"] });
    void queryClient.invalidateQueries({ queryKey: ["departures"] });
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await adminLogin(password);
      await load();
    } catch {
      setError("Invalid password or backend offline");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setLoggedIn(false);
    setPassword("");
  };

  if (!FEATURES.admin) {
    return <Redirect href="/(tabs)/tools" />;
  }

  if (!loggedIn) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.bg }}
        behavior={keyboardAvoidingBehavior()}
      >
        <ScreenTitle
          title="Admin"
          left={
            <BackButton variant="plain" onPress={goBack} />
          }
        />
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: SPACING.screen }}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: c.card,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: c.separator,
              }}
            >
              <Shield size={32} color={c.primary} strokeWidth={2} />
            </View>
            <Txt size={22} weight="700" color={c.text} style={{ marginTop: 16 }}>
              Sign in
            </Txt>
            <Txt size={14} color={c.textSecondary} style={{ marginTop: 8, textAlign: "center" }}>
              Manage app content, stations, and service alerts.
            </Txt>
          </View>

          <Txt size={13} color={c.textSecondary} style={{ marginBottom: 6 }}>
            Password
          </Txt>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="From ADMIN_PASSWORD in .env"
            placeholderTextColor={c.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            style={inputStyle(c)}
            onSubmitEditing={() => void handleLogin()}
          />
          {error ? (
            <Txt size={13} color="#FF3B30" style={{ marginTop: 8 }}>
              {error}
            </Txt>
          ) : null}

          <Pressable
            onPress={() => void handleLogin()}
            disabled={loading || !password.trim()}
            style={primaryBtn(c, loading || !password.trim())}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Lock size={18} color="#FFFFFF" strokeWidth={2} />
                <Txt size={16} weight="700" color="#FFFFFF" style={{ marginLeft: 8 }}>
                  Sign in
                </Txt>
              </>
            )}
          </Pressable>

        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title="Admin"
        left={<BackButton variant="plain" onPress={goBack} />}
        right={
          <Pressable
            onPress={() => void load()}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: "center", alignItems: "flex-end" }}
          >
            <RefreshCw size={20} color={c.primary} strokeWidth={2} />
          </Pressable>
        }
      />

      <View
        style={{
          marginHorizontal: SPACING.screen,
          marginBottom: 8,
          marginTop: 2,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.separator,
          backgroundColor: c.card,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Txt size={17} weight="700" color={c.text}>
          Control center
        </Txt>
        <Txt size={12} color={c.textSecondary} style={{ marginTop: 4 }}>
          {updatedAt
            ? `Last saved ${new Date(updatedAt).toLocaleString()}`
            : "Manage branding, maps, stations, and alerts."}
        </Txt>
      </View>

      <AdminStatRow
        items={[
          { label: "Stations", value: String(stations.length) },
          { label: "Alerts", value: String(alerts.length) },
          {
            label: "Status",
            value: config?.maintenanceMode ? "Maint." : "Live",
            tone: config?.maintenanceMode ? "warn" : "ok",
          },
        ]}
      />

      <AdminSegmentTabs tabs={TABS} active={tab} onChange={setTab} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: getStackContentClearance(insets.bottom) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === "config" && config ? (
          <View>
            <AdminConfigForm config={config} onChange={setConfig} />
            <SaveBar
              saving={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await adminSaveAppConfig(config);
                  invalidateApp();
                  await load();
                  Alert.alert("Saved", "App settings updated.");
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
        ) : null}

        {tab === "map" && config ? (
          <View>
            <AdminLogoPanel config={config} onChange={setConfig} onRefresh={load} />
            <AdminNetworkMapPanel config={config} onChange={setConfig} onRefresh={load} />
            <SaveBar
              saving={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await adminSaveAppConfig(config);
                  invalidateApp();
                  await load();
                  Alert.alert("Saved", "Map settings updated.");
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
        ) : null}

        {tab === "stations" ? (
          <View>
            <SectionHeader title={`Stations (${filteredStations.length})`} />
            <TextInput
              value={stationSearch}
              onChangeText={setStationSearch}
              placeholder="Search by name or ID"
              placeholderTextColor={c.textSecondary}
              style={{ ...inputStyle(c), marginHorizontal: SPACING.screen, marginBottom: 12 }}
            />
            <GroupedList>
              {filteredStations.slice(0, 50).map((s) => (
                <StationRow
                  key={s.id}
                  station={s}
                  expanded={expandedStation === s.id}
                  onToggle={() => setExpandedStation((id) => (id === s.id ? null : s.id))}
                  onChange={(next) => setStations((list) => list.map((x) => (x.id === s.id ? next : x)))}
                />
              ))}
            </GroupedList>
            {filteredStations.length > 50 ? (
              <Txt size={12} color={c.textSecondary} style={{ padding: SPACING.cell, textAlign: "center" }}>
                Showing first 50 — narrow your search to edit more.
              </Txt>
            ) : null}
            <SaveBar
              saving={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await adminSaveStations(stations);
                  invalidateApp();
                  await load();
                  Alert.alert("Saved", "Stations updated.");
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
        ) : null}

        {tab === "alerts" ? (
          <View>
            <SectionHeader title={`Alerts (${alerts.length})`} />
            <GroupedList>
              {alerts.map((a, i) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  onChange={(next) => setAlerts((list) => list.map((x, j) => (j === i ? next : x)))}
                  onRemove={() =>
                    Alert.alert("Remove alert", a.title, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => setAlerts((list) => list.filter((_, j) => j !== i)),
                      },
                    ])
                  }
                />
              ))}
            </GroupedList>
            <Pressable
              onPress={() =>
                setAlerts((list) => [
                  {
                    id: `alert_${Date.now()}`,
                    title: "New alert",
                    description: "",
                    mode: "train",
                    severity: "info",
                    affectedLine: "T1",
                  },
                  ...list,
                ])
              }
              style={{
                marginHorizontal: SPACING.screen,
                marginTop: 10,
                minHeight: MIN_TOUCH,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.separator,
                backgroundColor: c.muted,
              }}
            >
              <Txt size={15} weight="600" color={c.primary}>
                + Add alert
              </Txt>
            </Pressable>
            <SaveBar
              saving={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await adminSaveAlerts(alerts);
                  invalidateApp();
                  await load();
                  Alert.alert("Saved", "Alerts updated.");
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
        ) : null}

        <SectionHeader title="Danger zone" />
        <GroupedList>
          <Pressable
            onPress={() =>
              Alert.alert("Reset defaults", "Restore all admin data to factory defaults?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  style: "destructive",
                  onPress: async () => {
                    await adminResetDefaults();
                    await load();
                    invalidateApp();
                  },
                },
              ])
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: SPACING.cell,
              minHeight: MIN_TOUCH,
              gap: 10,
            }}
          >
            <Trash2 size={20} color="#FF3B30" strokeWidth={2} />
            <Txt size={16} color="#FF3B30" style={{ flex: 1 }}>
              Reset to defaults
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => void handleLogout()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: SPACING.cell,
              minHeight: MIN_TOUCH,
              gap: 10,
            }}
          >
            <LogOut size={20} color={c.textSecondary} strokeWidth={2} />
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Sign out
            </Txt>
          </Pressable>
        </GroupedList>
      </ScrollView>
    </View>
  );
}

function inputStyle(c: ReturnType<typeof useColors>) {
  return {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.separator,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: MIN_TOUCH,
    fontSize: 16,
    color: c.text,
    ...resolveTextStyle("400"),
  } as const;
}

function primaryBtn(c: ReturnType<typeof useColors>, disabled: boolean) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.primary,
    borderRadius: 12,
    minHeight: MIN_TOUCH + 4,
    marginTop: 16,
    opacity: disabled ? 0.5 : 1,
  };
}

function StationRow({
  station,
  expanded,
  onToggle,
  onChange,
}: {
  station: AdminStation;
  expanded: boolean;
  onToggle: () => void;
  onChange: (s: AdminStation) => void;
}) {
  const c = useColors();
  return (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: c.separator }}>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: "row", alignItems: "center", padding: 14, minHeight: MIN_TOUCH }}
      >
        <Train size={18} color={c.primary} strokeWidth={2} />
        <View style={{ flex: 1, marginLeft: SPACING.iconGap }}>
          <Txt size={16} weight="600" color={c.text} numberOfLines={1}>
            {station.name}
          </Txt>
          <Txt size={12} color={c.textSecondary} numberOfLines={1}>
            {station.id} · {station.mode}
          </Txt>
        </View>
        <ChevronRight
          size={18}
          color={c.textSecondary}
          style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
          strokeWidth={2}
        />
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
          <MiniField label="Name" value={station.name} onChange={(v) => onChange({ ...station, name: v })} />
          <MiniField label="Mode" value={station.mode} onChange={(v) => onChange({ ...station, mode: v })} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <MiniField label="Lat" value={String(station.lat)} onChange={(v) => onChange({ ...station, lat: parseFloat(v) || 0 })} />
            </View>
            <View style={{ flex: 1 }}>
              <MiniField label="Lon" value={String(station.lon)} onChange={(v) => onChange({ ...station, lon: parseFloat(v) || 0 })} />
            </View>
          </View>
          <AdminSwitch
            label="Hidden from app"
            value={!!station.disabled}
            onChange={(v) => onChange({ ...station, disabled: v })}
          />
        </View>
      ) : null}
    </View>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  return (
    <View>
      <Txt size={12} color={c.textSecondary}>
        {label}
      </Txt>
      <TextInput
        value={value ?? ""}
        onChangeText={onChange}
        style={{
          marginTop: 4,
          fontSize: 15,
          color: c.text,
          backgroundColor: c.muted,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          ...resolveTextStyle("400"),
        }}
      />
    </View>
  );
}

function AlertRow({
  alert,
  onChange,
  onRemove,
}: {
  alert: AdminAlert;
  onChange: (a: AdminAlert) => void;
  onRemove: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separator }}>
      <MiniField label="Title" value={alert.title ?? ""} onChange={(v) => onChange({ ...alert, title: v })} />
      <View style={{ height: 8 }} />
      <MiniField
        label="Description"
        value={alert.description ?? ""}
        onChange={(v) => onChange({ ...alert, description: v })}
      />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <MiniField label="Severity" value={alert.severity ?? ""} onChange={(v) => onChange({ ...alert, severity: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <MiniField label="Line" value={alert.affectedLine ?? ""} onChange={(v) => onChange({ ...alert, affectedLine: v })} />
        </View>
      </View>
      <Pressable onPress={onRemove} style={{ marginTop: 10 }}>
        <Txt size={14} weight="600" color="#FF3B30">
          Remove
        </Txt>
      </Pressable>
    </View>
  );
}

function SaveBar({ saving, onPress }: { saving: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={saving}
      style={{
        marginHorizontal: SPACING.screen,
        marginTop: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.primary,
        borderRadius: 10,
        minHeight: MIN_TOUCH + 4,
        opacity: saving ? 0.6 : 1,
        borderWidth: 1,
        borderColor: c.primary,
      }}
    >
      {saving ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Save size={18} color="#FFFFFF" strokeWidth={2} />
          <Txt size={16} weight="700" color="#FFFFFF" style={{ marginLeft: 8 }}>
            Save changes
          </Txt>
        </>
      )}
    </Pressable>
  );
}
