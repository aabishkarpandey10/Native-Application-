import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, ScrollView, View } from "react-native";
import { Image, type ImageLoadEventData, type ImageSource } from "expo-image";
import { useAppConfig } from "../../hooks/useAppConfig";
import {
  resolveNetworkMapImageFallbacks,
  resolveNetworkMapImageSource,
} from "../../utils/networkMapUri";

const MAP_BG = "#0a1622";

export function SydneyRailSchematicImage() {
  const { data: config } = useAppConfig();
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);

  const sources = useMemo(
    () => resolveNetworkMapImageFallbacks(config ?? null),
    [config?.networkMapUrl, config?.networkMapUpdatedAt, config?.networkMapHasUpload]
  );

  const source: ImageSource = sources[Math.min(sourceIndex, sources.length - 1)] ?? sources[0];

  useEffect(() => {
    setSourceIndex(0);
    setNatural(null);
  }, [config?.networkMapUrl, config?.networkMapUpdatedAt, config?.networkMapHasUpload]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width, h: height });
  };

  const onImageLoad = (e: ImageLoadEventData) => {
    const { width, height } = e.source;
    if (width > 0 && height > 0) {
      setNatural({ w: width, h: height });
    }
  };

  const onImageError = useCallback(() => {
    setSourceIndex((i) => (i + 1 < sources.length ? i + 1 : i));
    setNatural(null);
  }, [sources.length]);

  const imageSize = useMemo(() => {
    if (!natural || layout.w <= 0) return null;
    const width = layout.w;
    const height = (natural.h / natural.w) * width;
    return { width, height };
  }, [natural, layout.w]);

  const canShow = layout.w > 0;
  const cacheKey = String(
    config?.networkMapUpdatedAt ?? config?.networkMapHasUpload ?? config?.networkMapUrl ?? "default"
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: MAP_BG }}
      onLayout={onLayout}
      accessibilityLabel="Sydney Metropolitan Rail System schematic map"
    >
      {canShow ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            alignItems: "center",
            paddingVertical: 8,
            minHeight: layout.h > 0 ? layout.h : undefined,
          }}
          showsVerticalScrollIndicator
          showsHorizontalScrollIndicator={Platform.OS !== "web"}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent={Platform.OS === "ios"}
          bouncesZoom
        >
          <Image
            key={`${cacheKey}-${sourceIndex}`}
            source={source}
            style={
              imageSize
                ? { width: imageSize.width, height: imageSize.height }
                : { width: layout.w, minHeight: layout.h || 400 }
            }
            contentFit="contain"
            cachePolicy="none"
            onLoad={onImageLoad}
            onError={onImageError}
            accessibilityLabel="Sydney Metropolitan Rail System map"
          />
        </ScrollView>
      ) : null}
    </View>
  );
}
