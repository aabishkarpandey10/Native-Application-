import { useNavigation } from "expo-router";
import { FeatureGate } from "../../components/FeatureGate";
import { AlertsFeed } from "../../components/screens/AlertsFeed";
import { useAppFeatures } from "../../hooks/useAppFeatures";
import { useSafeBack } from "../../hooks/useSafeBack";
import { navigationCanPop } from "../../utils/navigationBack";

/** Service alerts — opened from Tools tab or stack. */
export default function AlertsTab() {
  const { alerts } = useAppFeatures();
  const navigation = useNavigation();
  const goBack = useSafeBack("/(tabs)/tools");
  return (
    <FeatureGate
      enabled={alerts}
      title="Service alerts unavailable"
      message="Service information is turned off in admin settings."
    >
      <AlertsFeed tabScreen showBack={navigationCanPop(navigation)} onBack={goBack} />
    </FeatureGate>
  );
}
