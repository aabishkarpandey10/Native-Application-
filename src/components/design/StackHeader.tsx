import { type ReactNode } from "react";
import { BackButton } from "./BackButton";
import { ScreenTitle } from "../tripview/ScreenTitle";

interface StackHeaderProps {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}

/** Stack screen header — same chrome as tab screens (web + Expo Go). */
export function StackHeader({ title, onBack, right }: StackHeaderProps) {
  return <ScreenTitle title={title} left={<BackButton variant="plain" onPress={onBack} />} right={right} />;
}
