import { Platform } from "react-native";

/** Keyboard avoidance — web matches iOS padding; Android uses height. */
export function keyboardAvoidingBehavior(): "padding" | "height" | undefined {
  if (Platform.OS === "android") return "height";
  return "padding";
}
