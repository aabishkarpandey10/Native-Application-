import { FeatureGate } from "../components/FeatureGate";
import { AlertsFeed } from "../components/screens/AlertsFeed";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useSafeBack } from "../hooks/useSafeBack";

export default function AlertsScreen() {
  const { alerts } = useAppFeatures();
  const goBack = useSafeBack("/(tabs)/tools");
  return (
    <FeatureGate
      enabled={alerts}
      title="Service alerts unavailable"
      message="Service information is turned off in admin settings."
    >
      <AlertsFeed showBack onBack={goBack} />
    </FeatureGate>
  );
}
