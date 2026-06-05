import { Redirect } from "expo-router";

/** Declarative redirect — avoids "navigate before Root Layout mounted" on web. */
export default function Index() {
  return <Redirect href="/(tabs)/favourites" />;
}
