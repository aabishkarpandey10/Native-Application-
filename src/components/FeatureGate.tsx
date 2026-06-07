import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { EmptyState } from "./design";

type FeatureGateProps = {
  enabled: boolean;
  children: ReactNode;
  /** Where to send users when the feature is disabled from admin. */
  fallbackHref?: "/(tabs)/tools" | "/(tabs)/about";
  /** Inline message instead of redirect (for tab screens). */
  inline?: boolean;
  title?: string;
  message?: string;
};

export function FeatureGate({
  enabled,
  children,
  fallbackHref = "/(tabs)/tools",
  inline = false,
  title = "Unavailable",
  message = "This feature is turned off in admin settings.",
}: FeatureGateProps) {
  if (enabled) return <>{children}</>;
  if (inline) {
    return <EmptyState title={title} message={message} />;
  }
  return <Redirect href={fallbackHref} />;
}
