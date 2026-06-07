import { View } from "react-native";
import { GroupedList, SectionHeader } from "../design";
import type { AppConfig } from "../../types/appConfig";
import { AdminField, AdminNumber, AdminSwitch } from "./AdminFields";

export function AdminConfigForm({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
}) {
  const set = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <View>
      <SectionHeader title="Branding" />
      <GroupedList>
        <AdminField label="App name" value={config.appName} onChange={(v) => set("appName", v)} />
        <AdminField label="Tagline" value={config.tagline} onChange={(v) => set("tagline", v)} />
        <AdminField
          label="Announcement"
          value={config.announcement}
          onChange={(v) => set("announcement", v)}
          multiline
        />
        <AdminSwitch
          label="Show announcement banner"
          value={config.showAnnouncementBanner}
          onChange={(v) => set("showAnnouncementBanner", v)}
        />
        <AdminSwitch
          label="Maintenance mode"
          value={config.maintenanceMode}
          onChange={(v) => set("maintenanceMode", v)}
        />
        <AdminField
          label="Maintenance message"
          value={config.maintenanceMessage}
          onChange={(v) => set("maintenanceMessage", v)}
          multiline
        />
      </GroupedList>

      <SectionHeader title="Appearance" />
      <GroupedList>
        <AdminField
          label="Default theme"
          value={config.defaultTheme}
          onChange={(v) => set("defaultTheme", v === "light" ? "light" : "dark")}
          hint="Type light or dark"
        />
        <AdminSwitch
          label="Let users change theme in Settings"
          value={config.allowUserTheme}
          onChange={(v) => set("allowUserTheme", v)}
        />
        <AdminField
          label="App accent colour"
          value={config.accentColor}
          onChange={(v) => set("accentColor", v)}
          hint="#0079C1 or #E31837"
        />
      </GroupedList>

      <SectionHeader title="Notifications" />
      <GroupedList>
        <AdminSwitch
          label="Service alerts on by default (new users)"
          value={config.notificationsDefaultOn}
          onChange={(v) => set("notificationsDefaultOn", v)}
        />
        <AdminField
          label="Settings help text"
          value={config.notificationsHelpText}
          onChange={(v) => set("notificationsHelpText", v)}
          multiline
        />
      </GroupedList>

      <SectionHeader title="Features" />
      <GroupedList>
        <AdminSwitch label="Trip planner" value={config.featureTripPlanner} onChange={(v) => set("featureTripPlanner", v)} />
        <AdminSwitch label="Maps" value={config.featureMaps} onChange={(v) => set("featureMaps", v)} />
        <AdminSwitch label="Service alerts tab" value={config.featureAlerts} onChange={(v) => set("featureAlerts", v)} />
        <AdminSwitch label="Favourites & saved trips" value={config.featureFavourites} onChange={(v) => set("featureFavourites", v)} />
        <AdminSwitch label="AI assistant" value={config.featureAiChat} onChange={(v) => set("featureAiChat", v)} />
      </GroupedList>

      <SectionHeader title="Live data (seconds)" />
      <GroupedList>
        <AdminNumber label="Alerts refresh" value={config.alertsRefreshSec} onChange={(v) => set("alertsRefreshSec", v)} />
        <AdminNumber
          label="Departures refresh"
          value={config.departuresRefreshSec}
          onChange={(v) => set("departuresRefreshSec", v)}
        />
        <AdminNumber
          label="Trip results refresh"
          value={config.tripPlanRefreshSec}
          onChange={(v) => set("tripPlanRefreshSec", v)}
        />
      </GroupedList>

      <SectionHeader title="Links" />
      <GroupedList>
        <AdminField label="Transport for NSW URL" value={config.linkTransportNsw} onChange={(v) => set("linkTransportNsw", v)} />
        <AdminField label="Open data URL" value={config.linkOpenData} onChange={(v) => set("linkOpenData", v)} />
      </GroupedList>

      <SectionHeader title="In-app text" />
      <GroupedList>
        <AdminField
          label="About disclaimer"
          value={config.aboutDisclaimer}
          onChange={(v) => set("aboutDisclaimer", v)}
          multiline
        />
      </GroupedList>

      <SectionHeader title="Trips" />
      <GroupedList>
        <AdminSwitch
          label="Show walking legs in trip details"
          value={config.showWalkLegsInTrips}
          onChange={(v) => set("showWalkLegsInTrips", v)}
        />
      </GroupedList>
    </View>
  );
}
