declare module "react-native-web" {
  import type { ReactNode } from "react";
  export function unstable_createElement(
    type: string,
    props?: Record<string, unknown> | null,
    ...children: ReactNode[]
  ): ReactNode;
}
