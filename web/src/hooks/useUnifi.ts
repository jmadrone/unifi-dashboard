import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const REFRESH_FAST = 15_000;
const REFRESH_MEDIUM = 30_000;
const REFRESH_SLOW = 60_000;

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: REFRESH_SLOW,
  });
}

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: api.overview,
    refetchInterval: REFRESH_FAST,
  });
}

export function useHosts() {
  return useQuery({
    queryKey: ["hosts"],
    queryFn: api.hosts,
    refetchInterval: REFRESH_MEDIUM,
  });
}

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: api.sites,
    refetchInterval: REFRESH_MEDIUM,
  });
}

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: api.devices,
    refetchInterval: REFRESH_MEDIUM,
  });
}

export function useIspMetrics(
  interval: "5m" | "1h" = "5m",
  params: Parameters<typeof api.ispMetrics>[1] = {},
) {
  return useQuery({
    queryKey: ["isp-metrics", interval, params],
    queryFn: () => api.ispMetrics(interval, params),
    refetchInterval: interval === "5m" ? REFRESH_MEDIUM : REFRESH_SLOW,
  });
}
