declare module "expo-notifications" {
  export const AndroidImportance: { HIGH: number };
  export function setNotificationHandler(handler: {
    handleNotification: () => Promise<Record<string, boolean>>;
  }): void;
  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
  export function setNotificationChannelAsync(
    id: string,
    channel: Record<string, unknown>
  ): Promise<void>;
  export function getExpoPushTokenAsync(): Promise<{ data: string }>;
}
