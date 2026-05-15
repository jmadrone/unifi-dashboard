import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UnifiIspMetricGroup } from "@/lib/api";

type Point = {
  time: number;
  label: string;
  downloadMbps: number;
  uploadMbps: number;
  avgLatency: number;
  maxLatency: number;
  packetLoss: number;
  uptime: number;
};

function buildPoints(groups: UnifiIspMetricGroup[] | undefined): Point[] {
  if (!groups?.length) return [];
  const points: Point[] = [];
  for (const g of groups) {
    for (const p of g.periods ?? []) {
      const w = p.data?.wan;
      if (!p.metricTime || !w) continue;
      const t = new Date(p.metricTime).getTime();
      points.push({
        time: t,
        label: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        downloadMbps: (Number(w.download_kbps ?? 0)) / 1000,
        uploadMbps: (Number(w.upload_kbps ?? 0)) / 1000,
        avgLatency: Number(w.avgLatency ?? 0),
        maxLatency: Number(w.maxLatency ?? 0),
        packetLoss: Number(w.packetLoss ?? 0),
        uptime: Number(w.uptime ?? 0),
      });
    }
  }
  points.sort((a, b) => a.time - b.time);
  return points;
}

const tooltipStyle = {
  background: "hsl(222 28% 10%)",
  border: "1px solid hsl(222 18% 22%)",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function BandwidthChart({
  data,
  loading,
}: {
  data: UnifiIspMetricGroup[] | undefined;
  loading?: boolean;
}) {
  const points = useMemo(() => buildPoints(data), [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>WAN throughput (Mbps)</CardTitle>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <Legend color="hsl(196 95% 55%)" label="Download" />
          <Legend color="hsl(265 80% 65%)" label="Upload" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : points.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="dl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(196 95% 55%)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(196 95% 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ul" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(265 80% 65%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(265 80% 65%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(222 18% 18%)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="hsl(222 12% 60%)" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(222 12% 60%)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 20% 96%)" }} />
              <Area
                type="monotone"
                dataKey="downloadMbps"
                stroke="hsl(196 95% 55%)"
                strokeWidth={2}
                fill="url(#dl)"
                name="Download Mbps"
              />
              <Area
                type="monotone"
                dataKey="uploadMbps"
                stroke="hsl(265 80% 65%)"
                strokeWidth={2}
                fill="url(#ul)"
                name="Upload Mbps"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function LatencyChart({
  data,
  loading,
}: {
  data: UnifiIspMetricGroup[] | undefined;
  loading?: boolean;
}) {
  const points = useMemo(() => buildPoints(data), [data]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>WAN latency (ms) &amp; packet loss</CardTitle>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <Legend color="hsl(38 95% 60%)" label="Avg latency" />
          <Legend color="hsl(0 80% 62%)" label="Packet loss %" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : points.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="hsl(222 18% 18%)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="hsl(222 12% 60%)" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="ms" stroke="hsl(222 12% 60%)" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="loss"
                orientation="right"
                stroke="hsl(222 12% 60%)"
                tick={{ fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210 20% 96%)" }} />
              <Line
                yAxisId="ms"
                type="monotone"
                dataKey="avgLatency"
                stroke="hsl(38 95% 60%)"
                strokeWidth={2}
                dot={false}
                name="Avg latency (ms)"
              />
              <Line
                yAxisId="loss"
                type="monotone"
                dataKey="packetLoss"
                stroke="hsl(0 80% 62%)"
                strokeWidth={2}
                dot={false}
                name="Packet loss (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="h-56 grid place-items-center text-sm text-muted">
      No ISP metrics in this window.
    </div>
  );
}
