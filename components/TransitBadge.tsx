import type { Company, RouteCfg } from "@/lib/transit";
import { CO_LABEL } from "@/lib/transit";
import { mtrLine } from "@/lib/mtr";

const CO_STYLE: Record<Company, string> = {
  KMB: "bg-[#c8102e] text-white",
  CTB: "bg-[#f2b200] text-ink",
  MTR: "bg-[#ad1f2c] text-white",
};

export function CoChip({ co }: { co: Company }) {
  return <span className={`px-1.5 py-0.5 text-xs font-extrabold ${CO_STYLE[co]}`}>{CO_LABEL[co]}</span>;
}

export function routeTitle(r: RouteCfg) {
  return r.co === "MTR" ? mtrLine(r.route)?.name ?? r.route : r.route;
}

export default function TransitBadge({ route }: { route: RouteCfg }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <CoChip co={route.co} />
      <b className="shrink-0">{routeTitle(route)}</b>
    </span>
  );
}
