"use client";
import { useEffect, useState } from "react";
import type { Settings } from "@/lib/types";
import {
  CO_LABEL,
  defaultRideMin,
  mtrDirection,
  mtrStops,
  routeStops,
  searchRoutes,
  type Company,
  type RouteCfg,
  type RouteOption,
  type StopOption,
} from "@/lib/transit";
import { MTR_LINES, mtrLine } from "@/lib/mtr";
import type { LiveTransit } from "@/lib/target";
import { fmtClock } from "@/lib/time";
import { CoChip } from "./TransitBadge";

type Slot = "primary" | "backup";

export default function RouteView({
  settings,
  live,
  onSettings,
  onBack,
}: {
  settings: Settings;
  live: LiveTransit & { error: string | null; loading: boolean };
  onSettings: (s: Settings) => void;
  onBack: () => void;
}) {
  const [slot, setSlot] = useState<Slot>("primary");
  const saved = settings.transit[slot];
  const [editing, setEditing] = useState(!saved);

  useEffect(() => setEditing(!settings.transit[slot]), [slot, settings.transit]);

  const setT = (patch: Partial<Settings["transit"]>) => onSettings({ ...settings, transit: { ...settings.transit, ...patch } });
  const result = live[slot];
  const now = Date.now();

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-paper pb-10">
      <div className="flex items-center justify-between border-b-[3px] border-ink px-4 py-3">
        <button onClick={onBack} className="h-10 font-semibold text-ink">
          ← 返回
        </button>
        <b className="text-ink">交通路線</b>
        <span className="w-12" />
      </div>

      <div className="mx-5 my-4 grid grid-cols-2 border-[1.5px] border-ink">
        {(["primary", "backup"] as const).map((k, i) => (
          <button
            key={k}
            onClick={() => setSlot(k)}
            className={`h-11 font-bold ${i ? "border-l-[1.5px] border-ink" : ""} ${slot === k ? "bg-ink text-white" : "text-ink"}`}
          >
            {k === "primary" ? "首選" : "備案"}
          </button>
        ))}
      </div>

      {saved && !editing ? (
        <>
          <div className="border-y border-ink px-5 py-4">
            <div className="flex items-center gap-2">
              <CoChip co={saved.co} />
              <b className="text-lg text-ink">{saved.co === "MTR" ? mtrLine(saved.route)?.name : saved.route}</b>
              <span className="text-sub">{saved.destName}</span>
            </div>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-[15px]">
              <dt className="text-ink">上車：{saved.from.name}</dt>
              <dd className="tnum text-sub">步行 {saved.walkToMin} 分</dd>
              <dt className="text-ink">下車：{saved.to.name}</dt>
              <dd className="tnum text-sub">步行 {saved.walkFromMin} 分</dd>
              <dt className="text-ink">乘車時間</dt>
              <dd className="tnum text-sub">約 {saved.rideMin} 分</dd>
            </dl>
            <div className="mt-4 grid grid-cols-2 border-[1.5px] border-ink">
              <button onClick={() => setEditing(true)} className="h-11 font-bold text-ink">
                修改
              </button>
              <button onClick={() => setT({ [slot]: null })} className="h-11 border-l-[1.5px] border-ink font-bold text-danger">
                刪除
              </button>
            </div>
          </div>

          <div className="px-5 pb-1 pt-5 text-[15px] font-extrabold text-ink">實時班次（每 30 秒更新）</div>
          {live.error && <p className="px-5 text-[14px] text-danger">{live.error}</p>}
          {!result && !live.error && <p className="px-5 text-[14px] text-sub">{live.loading ? "載入中…" : "暫無資料"}</p>}
          {result && result.departures.length === 0 && <p className="px-5 text-[14px] text-sub">暫時沒有班次資料</p>}
          {result?.departures.map((d, i) => {
            const ok = d.leaveBy >= now;
            return (
              <div
                key={i}
                className={`grid grid-cols-[3.6rem_1fr_auto] items-center border-b border-line px-5 py-2.5 ${ok ? "" : "text-faint"}`}
              >
                <span className="tnum text-lg font-extrabold">{fmtClock(d.board)}</span>
                <span className="text-[15px]">{ok ? `${fmtClock(d.leaveBy)} 前出門` : "來不及"}</span>
                <span className={`tnum text-[15px] font-bold ${ok ? "text-ink" : ""}`}>
                  {fmtClock(d.arriveAt)} 到{d.estimated ? "（估）" : ""}
                </span>
              </div>
            );
          })}
        </>
      ) : (
        <RouteEditor
          key={slot}
          initial={saved}
          onCancel={saved ? () => setEditing(false) : undefined}
          onSave={(r) => {
            setT({ [slot]: r });
            setEditing(false);
          }}
        />
      )}

      <section className="mt-6 border-t border-ink">
        <Stepper
          label="出門準備緩衝"
          hint="穿鞋、鎖門、等電梯"
          value={settings.transit.doorBufferMin}
          onChange={(v) => setT({ doorBufferMin: v })}
        />
        {!settings.transit.primary && (
          <Stepper
            label="路程時間（未設定路線時）"
            hint="以到達時間計算時使用"
            value={settings.manualTravelMin}
            step={5}
            onChange={(v) => onSettings({ ...settings, manualTravelMin: v })}
          />
        )}
      </section>
      <p className="px-5 pt-3 text-[13px] leading-relaxed text-sub">
        最晚出門 ＝ 班次到站 － 出門準備緩衝 － 步行到站。到達時間 ＝ 下車時間 ＋ 步行到目的地。下車時間以下車站的實時資料推算，未能配對時以乘車時間估算。
      </p>
    </main>
  );
}

function Stepper({
  label,
  hint,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-ink">{label}</span>
        {hint && <span className="block text-[13px] text-sub">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center border-[1.5px] border-ink">
        <button onClick={() => onChange(Math.max(0, value - step))} className="h-10 w-10 text-xl text-ink" aria-label={`${label}減少`}>
          −
        </button>
        <span className="tnum w-14 text-center font-extrabold text-ink">{value} 分</span>
        <button onClick={() => onChange(Math.min(180, value + step))} className="h-10 w-10 text-xl text-ink" aria-label={`${label}增加`}>
          ＋
        </button>
      </span>
    </div>
  );
}

function RouteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: RouteCfg | null;
  onSave: (r: RouteCfg) => void;
  onCancel?: () => void;
}) {
  const [co, setCo] = useState<Company>(initial?.co ?? "KMB");
  const [q, setQ] = useState(initial && initial.co !== "MTR" ? initial.route : "");
  const [options, setOptions] = useState<RouteOption[] | null>(null);
  const [opt, setOpt] = useState<RouteOption | null>(null);
  const [line, setLine] = useState(initial?.co === "MTR" ? initial.route : "");
  const [stops, setStops] = useState<StopOption[]>(initial?.co === "MTR" ? mtrStops(initial.route) : []);
  const [fromId, setFromId] = useState(initial?.from.id ?? "");
  const [toId, setToId] = useState(initial?.to.id ?? "");
  const [walkTo, setWalkTo] = useState(initial?.walkToMin ?? 6);
  const [walkFrom, setWalkFrom] = useState(initial?.walkFromMin ?? 5);
  const [ride, setRide] = useState<number | null>(initial?.rideMin ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 修改已存路線時重新載入巴士站點
  useEffect(() => {
    if (!initial || initial.co === "MTR") return;
    const o: RouteOption = { co: initial.co, route: initial.route, dir: initial.dir, serviceType: initial.serviceType, orig: "", dest: initial.destName.replace(/^往/, "") };
    setOpt(o);
    routeStops(o).then(setStops).catch(() => setErr("未能載入站點"));
  }, [initial]);

  const search = async () => {
    if (co === "MTR") return;
    setBusy(true);
    setErr(null);
    setOpt(null);
    setStops([]);
    try {
      const res = await searchRoutes(co, q);
      setOptions(res);
      if (!res.length) setErr("找不到此路線");
    } catch {
      setErr("未能連線，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  const pickOption = async (o: RouteOption) => {
    setOpt(o);
    setFromId("");
    setToId("");
    setRide(null);
    setBusy(true);
    setErr(null);
    try {
      setStops(await routeStops(o));
    } catch {
      setErr("未能載入站點");
    } finally {
      setBusy(false);
    }
  };

  const from = stops.find((s) => s.id === fromId);
  const to = stops.find((s) => s.id === toId);
  const toChoices = co === "MTR" ? stops.filter((s) => s.id !== fromId) : stops.filter((s) => !from || s.seq > from.seq);
  const autoRide = from && to ? defaultRideMin(co, Math.abs(to.seq - from.seq)) : null;
  const rideMin = ride ?? autoRide ?? 10;
  const ready = !!from && !!to && (co === "MTR" ? !!line : !!opt);

  const save = () => {
    if (!from || !to) return;
    if (co === "MTR") {
      const dir = mtrDirection(line, from.id, to.id);
      const l = mtrLine(line)!;
      const term = dir === "UP" ? l.stations[l.stations.length - 1][1] : l.stations[0][1];
      onSave({ co, route: line, dir, serviceType: "1", destName: `往${term}方向`, from, to, walkToMin: walkTo, walkFromMin: walkFrom, rideMin });
    } else if (opt) {
      onSave({ co, route: opt.route, dir: opt.dir, serviceType: opt.serviceType, destName: `往${opt.dest}`, from, to, walkToMin: walkTo, walkFromMin: walkFrom, rideMin });
    }
  };

  const field = "block border-b border-line px-5 py-3";
  const select = "mt-1 w-full appearance-none bg-transparent text-[17px] font-extrabold text-ink";

  return (
    <div className="border-t border-ink">
      <div className={field}>
        <span className="block text-[13px] text-sub">交通工具</span>
        <div className="mt-2 grid grid-cols-3 border-[1.5px] border-ink">
          {(["KMB", "CTB", "MTR"] as const).map((c, i) => (
            <button
              key={c}
              onClick={() => {
                setCo(c);
                setOptions(null);
                setOpt(null);
                setStops([]);
                setFromId("");
                setToId("");
                setRide(null);
                setLine("");
              }}
              className={`h-11 font-bold ${i ? "border-l-[1.5px] border-ink" : ""} ${co === c ? "bg-ink text-white" : "text-ink"}`}
            >
              {CO_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {co === "MTR" ? (
        <div className={field}>
          <span className="block text-[13px] text-sub">路綫</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MTR_LINES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLine(l.code);
                  setStops(mtrStops(l.code));
                  setFromId("");
                  setToId("");
                  setRide(null);
                }}
                className={`border-[1.5px] px-2.5 py-1.5 text-[14px] font-bold ${line === l.code ? "text-white" : "text-ink"}`}
                style={{ borderColor: l.color, background: line === l.code ? l.color : "transparent" }}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={field}>
          <span className="block text-[13px] text-sub">路線號碼</span>
          <div className="mt-1 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="例如 1A"
              inputMode="text"
              autoCapitalize="characters"
              className="h-12 min-w-0 flex-1 border-[1.5px] border-ink px-3 text-lg font-extrabold text-ink placeholder:font-normal placeholder:text-faint"
            />
            <button onClick={search} disabled={!q || busy} className="h-12 bg-ink px-5 font-bold text-white disabled:opacity-40">
              搜尋
            </button>
          </div>
          {options && options.length > 0 && (
            <div className="mt-3 border-t border-line">
              {options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => pickOption(o)}
                  className={`flex w-full items-center gap-3 border-b border-line py-2.5 text-left ${opt === o ? "font-extrabold" : ""}`}
                >
                  <span className={`h-4 w-4 shrink-0 border-[1.5px] border-ink ${opt === o ? "bg-ink" : ""}`} />
                  <span className="text-[15px] text-ink">
                    往{o.dest}
                    <span className="ml-1 text-sub">（{o.orig} 開出{o.serviceType !== "1" ? "・特別班次" : ""}）</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {opt && !options && <p className="mt-2 text-[15px] text-ink">往{opt.dest}</p>}
        </div>
      )}

      {busy && <p className="px-5 py-2 text-[14px] text-sub">載入中…</p>}
      {err && <p className="px-5 py-2 text-[14px] text-danger">{err}</p>}

      {stops.length > 0 && (
        <>
          <label className={field}>
            <span className="block text-[13px] text-sub">上車站</span>
            <select value={fromId} onChange={(e) => { setFromId(e.target.value); setToId(""); setRide(null); }} className={select}>
              <option value="">請選擇</option>
              {stops.map((s) => (
                <option key={s.id + s.seq} value={s.id}>
                  {co === "MTR" ? s.name : `${s.seq}. ${s.name}`}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className="block text-[13px] text-sub">下車站</span>
            <select value={toId} onChange={(e) => { setToId(e.target.value); setRide(null); }} className={select} disabled={!fromId}>
              <option value="">請選擇</option>
              {toChoices.map((s) => (
                <option key={s.id + s.seq} value={s.id}>
                  {co === "MTR" ? s.name : `${s.seq}. ${s.name}`}
                </option>
              ))}
            </select>
          </label>
          <Stepper label="步行到上車站" value={walkTo} onChange={setWalkTo} />
          <Stepper label="下車後步行到目的地" value={walkFrom} onChange={setWalkFrom} />
          {from && to && <Stepper label="乘車時間" hint="會按實時資料自動更新" value={rideMin} onChange={setRide} />}
        </>
      )}

      <div className="flex gap-2 px-5 pt-4">
        {onCancel && (
          <button onClick={onCancel} className="h-13 flex-1 border-[1.5px] border-ink py-3.5 font-bold text-ink">
            取消
          </button>
        )}
        <button onClick={save} disabled={!ready} className="h-13 flex-[2] bg-ink py-3.5 font-bold text-white disabled:opacity-40">
          儲存路線
        </button>
      </div>
    </div>
  );
}
