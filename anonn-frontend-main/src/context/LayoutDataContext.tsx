// src/context/LayoutDataContext.tsx
import { createContext, useContext } from "react";
import { useApiQuery } from "@/hooks/useApi";
import type {
  Bowl as BowlType,
  Organization as OrganizationType,
} from "../types/index";

interface LayoutData {
  bowls?: BowlType[];
  organizations?: OrganizationType[];
}

const LayoutDataContext = createContext<LayoutData>({});

export const useLayoutData = () => useContext(LayoutDataContext);

export const LayoutDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: bowls } = useApiQuery<BowlType[]>({
    endpoint: "bowls",
    queryKey: ["/api/bowls"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: (data: any) => data?.bowls || [],
  });

  const { data: organizations } = useApiQuery<OrganizationType[]>({
    endpoint: "companies",
    queryKey: ["/api/companies"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: (data: any) => data?.companies || [],
  });

  return (
    <LayoutDataContext.Provider value={{ bowls, organizations }}>
      {children}
    </LayoutDataContext.Provider>
  );
};
