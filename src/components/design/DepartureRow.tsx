import type { SampleDeparture } from "../../constants/sampleData";
import { ScheduleDepartureCard } from "../schedule/ScheduleDepartureCard";

interface DepartureRowProps {
  departure: SampleDeparture;
  onPress?: () => void;
  minHeight?: number;
  /** @deprecated Use card schedule layout; kept for API compatibility */
  flat?: boolean;
}

/** Departure row — delegates to the card-based schedule UI. */
export function DepartureRow({ departure, onPress, flat }: DepartureRowProps) {
  return (
    <ScheduleDepartureCard
      departure={departure}
      onPress={onPress}
      compact={!flat}
    />
  );
}
