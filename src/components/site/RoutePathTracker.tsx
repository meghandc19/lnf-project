"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";

const InitialRouteContext = createContext<string | null>(null);

export function useInitialRoutePath() {
  return useContext(InitialRouteContext);
}

export default function RoutePathTracker({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [initialPath] = useState(pathname);

  return <InitialRouteContext.Provider value={initialPath}>{children}</InitialRouteContext.Provider>;
}
