import { AlertsFeed } from "../components/screens/AlertsFeed";
import { useSafeBack } from "../hooks/useSafeBack";

export default function AlertsScreen() {
  const goBack = useSafeBack("/(tabs)/tools");
  return <AlertsFeed showBack onBack={goBack} />;
}
