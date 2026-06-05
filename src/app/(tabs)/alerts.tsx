import { useNavigation } from "expo-router";
import { AlertsFeed } from "../../components/screens/AlertsFeed";
import { useSafeBack } from "../../hooks/useSafeBack";
import { navigationCanPop } from "../../utils/navigationBack";

/** Service alerts — opened from Tools tab or stack. */
export default function AlertsTab() {
  const navigation = useNavigation();
  const goBack = useSafeBack("/(tabs)/tools");
  return <AlertsFeed showBack={navigationCanPop(navigation)} onBack={goBack} />;
}
