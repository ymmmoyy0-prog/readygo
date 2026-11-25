/**
 * 港鐵重鐵綫車站（次序：DOWN 終點 → UP 終點，即 index 遞增為 UP 方向）
 * 已用 rt.data.gov.hk Next Train API 核對各綫 UP／DOWN 終點。
 */
export interface MtrLine {
  code: string;
  name: string;
  color: string;
  stations: [code: string, name: string][];
  /** 支綫車站 → 必須的列車終點（例如往康城的車不停坑口） */
  branch?: Record<string, string>;
}

export const MTR_LINES: MtrLine[] = [
  {
    code: "TWL", name: "荃灣綫", color: "#e2231a",
    stations: [["CEN","中環"],["ADM","金鐘"],["TST","尖沙咀"],["JOR","佐敦"],["YMT","油麻地"],["MOK","旺角"],["PRE","太子"],["SSP","深水埗"],["CSW","長沙灣"],["LCK","荔枝角"],["MEF","美孚"],["LAK","荔景"],["KWF","葵芳"],["KWH","葵興"],["TWH","大窩口"],["TSW","荃灣"]],
  },
  {
    code: "ISL", name: "港島綫", color: "#0075c2",
    stations: [["KET","堅尼地城"],["HKU","香港大學"],["SYP","西營盤"],["SHW","上環"],["CEN","中環"],["ADM","金鐘"],["WAC","灣仔"],["CAB","銅鑼灣"],["TIH","天后"],["FOH","炮台山"],["NOP","北角"],["QUB","鰂魚涌"],["TAK","太古"],["SWH","西灣河"],["SKW","筲箕灣"],["HFC","杏花邨"],["CHW","柴灣"]],
  },
  {
    code: "KTL", name: "觀塘綫", color: "#00a040",
    stations: [["WHA","黃埔"],["HOM","何文田"],["YMT","油麻地"],["MOK","旺角"],["PRE","太子"],["SKM","石硤尾"],["KOT","九龍塘"],["LOF","樂富"],["WTS","黃大仙"],["DIH","鑽石山"],["CHH","彩虹"],["KOB","九龍灣"],["NTK","牛頭角"],["KWT","觀塘"],["LAT","藍田"],["YAT","油塘"],["TIK","調景嶺"]],
  },
  {
    code: "TKL", name: "將軍澳綫", color: "#7d499d",
    stations: [["NOP","北角"],["QUB","鰂魚涌"],["YAT","油塘"],["TIK","調景嶺"],["TKO","將軍澳"],["HAH","坑口"],["POA","寶琳"],["LHP","康城"]],
    branch: { HAH: "POA", POA: "POA", LHP: "LHP" },
  },
  {
    code: "EAL", name: "東鐵綫", color: "#5eb6e4",
    stations: [["ADM","金鐘"],["EXC","會展"],["HUH","紅磡"],["MKK","旺角東"],["KOT","九龍塘"],["TAW","大圍"],["SHT","沙田"],["FOT","火炭"],["RAC","馬場"],["UNI","大學"],["TAP","大埔墟"],["TWO","太和"],["FAN","粉嶺"],["SHS","上水"],["LOW","羅湖"],["LMC","落馬洲"]],
    branch: { LOW: "LOW", LMC: "LMC" },
  },
  {
    code: "TML", name: "屯馬綫", color: "#9a3b26",
    stations: [["WKS","烏溪沙"],["MOS","馬鞍山"],["HEO","恆安"],["TSH","大水坑"],["SHM","石門"],["CIO","第一城"],["STW","沙田圍"],["CKT","車公廟"],["TAW","大圍"],["HIK","顯徑"],["DIH","鑽石山"],["KAT","啟德"],["SUW","宋皇臺"],["TKW","土瓜灣"],["HOM","何文田"],["HUH","紅磡"],["ETS","尖東"],["AUS","柯士甸"],["NAC","南昌"],["MEF","美孚"],["TWW","荃灣西"],["KSR","錦上路"],["YUL","元朗"],["LOP","朗屏"],["TIS","天水圍"],["SIH","兆康"],["TUM","屯門"]],
  },
  {
    code: "TCL", name: "東涌綫", color: "#f7943e",
    stations: [["HOK","香港"],["KOW","九龍"],["OLY","奧運"],["NAC","南昌"],["LAK","荔景"],["TSY","青衣"],["SUN","欣澳"],["TUC","東涌"]],
  },
  {
    code: "AEL", name: "機場快綫", color: "#00888a",
    stations: [["HOK","香港"],["KOW","九龍"],["TSY","青衣"],["AIR","機場"],["AWE","博覽館"]],
  },
  {
    code: "SIL", name: "南港島綫", color: "#bac429",
    stations: [["ADM","金鐘"],["OCP","海洋公園"],["WCH","黃竹坑"],["LET","利東"],["SOH","海怡半島"]],
  },
  {
    code: "DRL", name: "迪士尼綫", color: "#f173ac",
    stations: [["DIS","迪士尼"],["SUN","欣澳"]],
  },
];

export const mtrLine = (code: string) => MTR_LINES.find((l) => l.code === code);

export function mtrIndex(line: MtrLine, sta: string) {
  return line.stations.findIndex(([c]) => c === sta);
}

/** 列車終點 dest 是否會停 target 站（方向 dir） */
export function trainServes(line: MtrLine, dest: string, target: string, dir: "UP" | "DOWN"): boolean {
  const need = line.branch?.[target];
  if (need && dir === "UP") return dest === need;
  const di = mtrIndex(line, dest);
  const ti = mtrIndex(line, target);
  if (di < 0 || ti < 0) return true;
  // 支綫終點與主綫比較：以分岔站之後的位置計算
  return dir === "UP" ? di >= ti : di <= ti;
}
