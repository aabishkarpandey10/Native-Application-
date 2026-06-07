import { Redirect } from "expo-router";
import { useAppFeatures } from "../hooks/useAppFeatures";

/** Always open Tools first — avoids layout jumps when remote config loads in production. */
export default function Index() {
  const { maintenance } = useAppFeatures();
  if (maintenance) {
    return <Redirect href="/(tabs)/about" />;
  }
  return <Redirect href="/(tabs)/tools" />;
}
