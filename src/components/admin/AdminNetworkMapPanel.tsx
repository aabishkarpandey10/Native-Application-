import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Map, Upload } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Cell, GroupedList, SectionHeader, Txt } from "../design";
import { MIN_TOUCH, SPACING } from "../../constants/design";
import type { AppConfig } from "../../types/appConfig";
import { useColors } from "../../hooks/useColors";
import {
  adminClearNetworkMap,
  adminSaveAppConfig,
  adminUploadNetworkMap,
} from "../../services/adminApi";
import { networkMapSourceLabel, resolveNetworkMapImageSource } from "../../utils/networkMapUri";
import { AdminField } from "./AdminFields";

export function AdminNetworkMapPanel({
  config,
  onChange,
  onRefresh,
}: {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["appConfig"] });
  };

  const previewSource = resolveNetworkMapImageSource(config);

  const uploadBase64 = useCallback(
    async (base64: string) => {
      setBusy(true);
      try {
        const result = await adminUploadNetworkMap(base64);
        invalidate();
        onChange({
          ...config,
          networkMapUrl: "",
          networkMapUpdatedAt: result.networkMapUpdatedAt,
          networkMapHasUpload: true,
        });
        await onRefresh?.();
        Alert.alert("Uploaded", "Network map is live for all users.");
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
      Alert.alert("Permission needed", "Allow photo library access to upload a map image.");
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

  const resetMap = useCallback(() => {
    Alert.alert("Reset network map", "Remove custom upload and URL? Users will see the default bundled map.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await adminClearNetworkMap();
            onChange({
              ...config,
              networkMapUrl: "",
              networkMapUpdatedAt: null,
              networkMapHasUpload: false,
            });
            invalidate();
            await onRefresh?.();
            Alert.alert("Reset", "Using the default network map.");
          } catch {
            Alert.alert("Error", "Could not reset map.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [config, onChange]);

  return (
    <View>
      <Txt
        size={12}
        color={c.primary}
        weight="600"
        uppercase
        style={{
          paddingHorizontal: SPACING.screen,
          paddingBottom: 4,
          letterSpacing: 0.4,
        }}
      >
        Admin only — not available in Settings
      </Txt>
      <Txt
        size={13}
        color={c.textSecondary}
        style={{ paddingHorizontal: SPACING.screen, paddingBottom: 12, lineHeight: 18 }}
      >
        Current source: {networkMapSourceLabel(config)}. Changes here update what users see under
        Settings → View network map.
      </Txt>

      <View
        style={{
          marginHorizontal: SPACING.screen,
          marginBottom: 16,
          height: 200,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#0a1622",
          borderWidth: 1,
          borderColor: c.separator,
        }}
      >
        <Image source={previewSource} style={{ width: "100%", height: "100%" }} contentFit="contain" />
      </View>

      <GroupedList inset={16}>
        <Cell minHeight={MIN_TOUCH} onPress={() => router.push("/map" as never)}>
          <Map size={20} color={c.primary} strokeWidth={2} />
          <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: 12 }}>
            Preview full screen
          </Txt>
        </Cell>
        <Cell
          minHeight={MIN_TOUCH}
          onPress={() => (Platform.OS === "web" ? pickImageWeb() : void pickImage())}
        >
          <Upload size={20} color={c.primary} strokeWidth={2} />
          <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: 12 }}>
            Upload PNG or JPG
          </Txt>
          {busy ? <ActivityIndicator color={c.primary} /> : null}
        </Cell>
        <Cell minHeight={MIN_TOUCH} onPress={resetMap}>
          <Txt size={16} color="#FF3B30" style={{ flex: 1 }}>
            Reset to default map
          </Txt>
        </Cell>
      </GroupedList>

      <SectionHeader title="Optional image URL" />
      <GroupedList inset={16}>
        <AdminField
          label="Hosted map URL"
          value={config.networkMapUrl ?? ""}
          onChange={(v) => onChange({ ...config, networkMapUrl: v })}
          hint="Optional direct link to a .png or .jpg. Uploaded file always takes priority."
        />
      </GroupedList>

      <SectionHeader title="Settings text" />
      <GroupedList inset={16}>
        <AdminField
          label="Description on Settings screen"
          value={config.settingsMapDescription ?? ""}
          onChange={(v) => onChange({ ...config, settingsMapDescription: v })}
          multiline
        />
      </GroupedList>

      {config.networkMapUpdatedAt ? (
        <Txt size={12} color={c.textSecondary} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          Last upload: {new Date(config.networkMapUpdatedAt).toLocaleString()}
        </Txt>
      ) : null}
    </View>
  );
}
