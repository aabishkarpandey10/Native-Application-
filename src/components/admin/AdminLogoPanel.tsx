import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Upload } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Cell, GroupedList, SectionHeader, Txt } from "../design";
import { MIN_TOUCH, SPACING } from "../../constants/design";
import type { AppConfig } from "../../types/appConfig";
import { useColors } from "../../hooks/useColors";
import {
  adminClearAppLogo,
  adminUploadAppLogo,
} from "../../services/adminApi";
import { AdminField } from "./AdminFields";
import { fetchAppConfig } from "../../services/appConfigService";
import { appLogoSourceLabel, resolveAppLogoImageSource } from "../../utils/appLogoUri";

export function AdminLogoPanel({
  config,
  onChange,
  onRefresh,
}: {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const c = useColors();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const syncAppConfigCache = async () => {
    await queryClient.fetchQuery({
      queryKey: ["appConfig"],
      queryFn: fetchAppConfig,
    });
  };

  const previewSource = resolveAppLogoImageSource(config);

  const uploadBase64 = useCallback(
    async (base64: string) => {
      setBusy(true);
      try {
        const result = await adminUploadAppLogo(base64);
        onChange({
          ...config,
          appLogoUrl: "",
          appLogoUpdatedAt: result.appLogoUpdatedAt,
          appLogoHasUpload: true,
        });
        await syncAppConfigCache();
        await onRefresh?.();
        Alert.alert("Uploaded", "App logo is live for all users.");
      } catch {
        Alert.alert("Upload failed", "Check that the backend is running and you are signed in.");
      } finally {
        setBusy(false);
      }
    },
    [config, onChange, onRefresh]
  );

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to upload a logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    await uploadBase64(result.assets[0].base64);
  }, [uploadBase64]);

  const pickImageWeb = useCallback(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result ?? "");
        const base64 = data.includes(",") ? data.split(",").pop()! : data;
        void uploadBase64(base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [uploadBase64]);

  const resetLogo = useCallback(() => {
    Alert.alert("Reset app logo", "Remove custom logo? Users will see the default app icon.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await adminClearAppLogo();
            onChange({
              ...config,
              appLogoUrl: "",
              appLogoUpdatedAt: null,
              appLogoHasUpload: false,
            });
            await syncAppConfigCache();
            await onRefresh?.();
            Alert.alert("Reset", "Using the default app logo.");
          } catch {
            Alert.alert("Error", "Could not reset logo.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [config, onChange, onRefresh]);

  return (
    <View>
      <SectionHeader title="App logo" />
      <Txt
        size={13}
        color={c.textSecondary}
        style={{ paddingHorizontal: SPACING.screen, paddingBottom: 12, lineHeight: 18 }}
      >
        Current source: {appLogoSourceLabel(config)}. Shown on startup, About, and Settings.
      </Txt>

      <View
        style={{
          marginHorizontal: SPACING.screen,
          marginBottom: 16,
          height: 140,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.separator,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          key={config.appLogoUpdatedAt ?? config.appLogoUrl ?? "default"}
          source={previewSource}
          style={{ width: 96, height: 96 }}
          contentFit="contain"
        />
      </View>

      <GroupedList inset={16}>
        <Cell
          minHeight={MIN_TOUCH}
          onPress={() => (Platform.OS === "web" ? pickImageWeb() : void pickImage())}
        >
          <Upload size={20} color={c.primary} strokeWidth={2} />
          <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: 12 }}>
            Upload logo image
          </Txt>
          {busy ? <ActivityIndicator color={c.primary} /> : null}
        </Cell>
        <Cell minHeight={MIN_TOUCH} onPress={resetLogo}>
          <Txt size={16} color="#FF3B30" style={{ flex: 1 }}>
            Reset to default logo
          </Txt>
        </Cell>
      </GroupedList>

      <SectionHeader title="Optional logo URL" />
      <GroupedList inset={16}>
        <AdminField
          label="Hosted logo URL"
          value={config.appLogoUrl ?? ""}
          onChange={(v) => onChange({ ...config, appLogoUrl: v })}
          hint="Optional direct link to .png or .jpg. Uploaded file always takes priority."
        />
      </GroupedList>

      {config.appLogoUpdatedAt ? (
        <Txt size={12} color={c.textSecondary} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          Last logo upload: {new Date(config.appLogoUpdatedAt).toLocaleString()}
        </Txt>
      ) : null}
    </View>
  );
}

