import { type ReactNode } from "react";
import { BackButton } from "../design/BackButton";
import { ScreenTitle } from "../tripview/ScreenTitle";

interface ScheduleScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  below?: ReactNode;
  live?: boolean;
}

/** Schedule / station detail header — uses shared ScreenTitle chrome. */
export function ScheduleScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  below,
  live,
}: ScheduleScreenHeaderProps) {
  return (
    <ScreenTitle
      align="start"
      title={title}
      subtitle={subtitle}
      live={live}
      left={onBack ? <BackButton onPress={onBack} /> : undefined}
      right={right}
      below={below}
    />
  );
}
