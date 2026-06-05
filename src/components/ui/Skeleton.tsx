import { View } from "react-native";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <View className={`bg-surface-elevated rounded-lg ${className}`} />;
}

export function DepartureCardSkeleton() {
  return (
    <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3">
      <View className="flex-row items-center">
        <Skeleton className="w-10 h-10 rounded-xl mr-3" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </View>
        <Skeleton className="h-6 w-12 rounded-lg" />
      </View>
    </View>
  );
}

export function TripCardSkeleton() {
  return (
    <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3">
      <Skeleton className="h-5 w-2/3 mb-3" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-4/5" />
    </View>
  );
}
