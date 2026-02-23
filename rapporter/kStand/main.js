const { useState, useRef, useCallback } = React;
const { BarChart, Bar, XAxis, YAxis, LabelList, Legend } = Recharts;

/* ── CONSTANTS ────────────────────────────────────────────────────────── */
const MONTHS_EN  = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
const MONTHS_MAP = { jan:1,feb:2,mars:3,apr:4,maj:5,juni:6,jul:7,aug:8,sep:9,okt:10,nov:11,dec:12 };
const DARK="#1a3044", MID="#4a7fa5", LIGHT="#8fb8d0", BG="#dce8f0", GREEN="#2e9e6e";
const LISTINGS_META = [
  { id:"1102", area:35 },
  { id:"1103", area:43 },
  { id:"1105", area:35 },
  { id:"1205", area:35 },
  { id:"1301", area:65 },
  { id:"1303", area:43 },
  { id:"1402", area:35 },
  { id:"1404", area:70 },
  { id:"1405", area:33 },
  { id:"1504", area:70 },
  { id:"1602", area:35 },
  { id:"1603", area:35 },
];
const LISTINGS_META_MAP = LISTINGS_META.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

/* Fixed Dec-2025 baseline — never overwritten by CSV */
const BASELINE_2025 = {
  revenue2025:   { Okt:183673, Nov:138264, Dec:166680 },
  occupancy2025: { Okt:79, Nov:68, Dec:70 },
  anr2025:       { Okt:1300, Nov:1155, Dec:1188 },
  totalRevenue2025: 488617,
  listings2025: [
    { id:"1102", area:35, Okt:16961, Nov:10632, Dec:9960 },
    { id:"1103", area:43, Okt:null,  Nov:9819,  Dec:15349 },
    { id:"1105", area:35, Okt:15485, Nov:6523,  Dec:10521 },
    { id:"1205", area:35, Okt:15339, Nov:10956, Dec:13644 },
    { id:"1301", area:65, Okt:19926, Nov:10754, Dec:15610 },
    { id:"1303", area:43, Okt:21142, Nov:12587, Dec:15533 },
    { id:"1402", area:35, Okt:null,  Nov:8652,  Dec:14957 },
    { id:"1404", area:70, Okt:17612, Nov:10718, Dec:18124 },
    { id:"1405", area:33, Okt:19747, Nov:10031, Dec:11719 },
    { id:"1504", area:70, Okt:22690, Nov:21912, Dec:17494 },
    { id:"1602", area:35, Okt:17239, Nov:11613, Dec:12353 },
    { id:"1603", area:35, Okt:17533, Nov:13098, Dec:11416 },
  ],
};

const DEF = {
  clientName:"Kungsholms Strand 167", reportDate:"",
  revenueBullets:[], occupancyBullets:[], anrBullets:[],
  listingsBullets:[], totalBullets:[], qualityBullets:[], actionsBullets:[],
  revenue2025: BASELINE_2025.revenue2025,
  occupancy2025: BASELINE_2025.occupancy2025,
  anr2025: BASELINE_2025.anr2025,
  totalRevenue2025: BASELINE_2025.totalRevenue2025,
  listings2025: BASELINE_2025.listings2025,
  revenue2026:{}, occupancy2026:{}, anr2026:{}, totalRevenue2026:0,
  quality:{ overall:5, cleanliness:4.93, accuracy:4.86, location:5, checkIn:5, communication:4.93, value:4.93 },
  listings:[],
  showDec25:true,
  selectedMonths: new Set(["Jan","Feb","Mar","Apr","Maj","Jun"]),
  listingStartMonth: "Jan",
  listingMonthsCount: 4,
};

/* ── CSV PARSER ───────────────────────────────────────────────────────── */
function parseNum(s){
  if(!s||s.trim()==="") return null;
  return parseFloat(s.replace(/\s/g,"").replace(",",".")) || null;
}
function parseMonthKey(str){
  const parts=str.toLowerCase().replace(/\./g,"").trim().split(" ");
  const idx=MONTHS_MAP[parts[0]]; if(!idx) return null;
  return { mon:MONTHS_EN[idx-1], year:parseInt(parts[1])||2026 };
}
function parseCSV(text){
  const lines=text.trim().split("\n").map(l=>l.replace(/^\uFEFF/,""));
  const headers=lines[0].split(",").map(h=>h.replace(/"/g,"").trim());
  const rows=lines.slice(1).map(line=>{
    const vals=[]; let cur="",inQ=false;
    for(const c of line){
      if(c==='"'){inQ=!inQ;continue;}
      if(c===","&&!inQ){vals.push(cur.trim());cur="";continue;}
      cur+=c;
    }
    vals.push(cur.trim());
    const row={}; headers.forEach((h,i)=>row[h]=(vals[i] === undefined ? "" : vals[i])); return row;
  }).filter(r=>r["Listing Nickname"]);

  const rev={},occArr={},anrArr={},listings={};
  for(const r of rows){
    const mk=parseMonthKey(r["Month"]); if(!mk||mk.year!==2026) continue;
    const {mon}=mk;
    const ownerRev=parseNum(r["Owner Revenue"]);
    const occ=parseNum(r["Occupancy"]);
    const anr=parseNum(r["ANR"]);
    const rawName=r["Listing Nickname"];
    const match=(rawName||"").match(/\b\d{4}\b/);
    const id=match?match[0]:rawName;
    if(!listings[id]) {
      const meta = LISTINGS_META_MAP[id] || {};
      listings[id]={ id:id, area:meta.area };
    }
    if(ownerRev){ listings[id][mon]=Math.round(ownerRev); rev[mon]=(rev[mon]||0)+ownerRev; }
    if(!occArr[mon]) occArr[mon]=[]; if(occ&&occ>0) occArr[mon].push(occ);
    if(!anrArr[mon]) anrArr[mon]=[]; if(anr&&anr>0) anrArr[mon].push(anr);
  }
  Object.keys(rev).forEach(k=>rev[k]=Math.round(rev[k]));
  const occ2026={};
  Object.keys(occArr).forEach(k=>{ const a=occArr[k].filter(v=>v>0); if(a.length) occ2026[k]=Math.round((a.reduce((x,y)=>x+y,0)/a.length)*100); });
  const anr2026={};
  Object.keys(anrArr).forEach(k=>{ const a=anrArr[k].filter(v=>v>0); if(a.length) anr2026[k]=Math.round(a.reduce((x,y)=>x+y,0)/a.length); });
  const total=Math.round(Object.values(rev).reduce((a,b)=>a+b,0));
  const merged=Object.values(listings).map(l=>{
    return Object.assign({}, l);
  });
  return {revenue2026:rev,occupancy2026:occ2026,anr2026:anr2026,totalRevenue2026:total,listings:merged};
}

/* ── PRINT STYLES ─────────────────────────────────────────────────────── */
const PRINT_STYLE = `
  @page { size: A4 landscape; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
    .screen-root { display: none !important; }
    #print-root, #print-root * { visibility: visible !important; }
    #print-root {
      position: relative !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      background: white !important;
    }
    .no-print { display: none !important; }
    .slide {
      width: 297mm !important;
      height: 210mm !important;
      min-height: 210mm !important;
      max-height: 210mm !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
      box-sizing: border-box !important;
      padding: 13mm 16mm 11mm !important;
      display: flex !important;
      flex-direction: column !important;
      background: white;
    }
    .slide.cover-slide { background: #dce8f0 !important; padding: 13mm 20mm 15mm !important; }
    .slide:last-child { page-break-after: avoid !important; break-after: avoid !important; }
    .slide-sep { display: none !important; }
  }
`;

/* ── HELPERS ──────────────────────────────────────────────────────────── */
const fmt = n => n!=null ? Math.round(n).toLocaleString("sv-SE") : "—";

/* Slide wrapper — fixed A4 landscape ratio in preview, enforced to exact size in print */
function Slide({ children, cover=false, style={} }) {
  return (
    <div className={`slide${cover?" cover-slide":""}`}
      style={Object.assign({},
        { width:"100%", aspectRatio:"297/210", boxSizing:"border-box",
          padding:"2% 5.2% 2%", display:"flex", flexDirection:"column",
          background: cover ? BG : "white", overflow:"hidden" },
        style
      )}>
      {children}
    </div>
  );
}

/* Visible separator between slides in preview only */
function SlideSep({ n, total }) {
  return (
    <div className="slide-sep"
      style={{ display:"flex", alignItems:"center", gap:12, margin:"0",
        background:"#d0d8e0", padding:"6px 20px" }}>
      <div style={{ fontSize:10, color:"#667", fontWeight:700, letterSpacing:1 }}>
        SLIDE {n} / {total}
      </div>
      <div style={{ flex:1, height:1, background:"#b0bcc8" }} />
    </div>
  );
}

function SlideHeader({ title }) {
  return (
    <div style={{ borderBottom:`2.5px solid ${DARK}`, paddingBottom:"1%", marginBottom:"1.5%",
      display:"flex", alignItems:"baseline", gap:10 }}>
      <span style={{ fontSize:"0.7em", fontWeight:900, letterSpacing:2, color:MID, textTransform:"uppercase" }}>Hostini</span>
      <span style={{ fontSize:"0.7em", color:"#bbb" }}>·</span>
      <span style={{ fontSize:"1.15em", fontWeight:700, color:DARK }}>{title}</span>
    </div>
  );
}

function BulletList({ bullets }) {
  if(!bullets||bullets.length===0) return null;
  return (
    <div style={{ borderTop:`2px solid #d0e6f0`, marginTop:"auto", paddingTop:"3%" }}>
      <ul style={{ margin:0, paddingLeft:22, listStyle:"disc" }}>
        {bullets.map((b,i)=>(
          <li key={i} style={{ fontSize:"1em", color:"#1a3044", lineHeight:1.6, marginBottom:"0.55em", fontWeight:500 }}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── CHART ────────────────────────────────────────────────────────────── */
function ReportChart({ chartData, formatter, domain, w=820, h=290 }) {
  const has25 = chartData.some(d=>d["2025"]!=null);
  const has26 = chartData.some(d=>d["2026"]!=null);
  return (
    <BarChart data={chartData} width={w} height={h}
      margin={{ top:28, right:10, left:0, bottom:0 }} barGap={2} barCategoryGap="26%">
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#888" }} />
      <YAxis axisLine={false} tickLine={false} tick={{ fontSize:10.5, fill:"#aaa" }}
        tickFormatter={formatter} domain={domain} width={44} />
      {has25 && (
        <Bar dataKey="2025" fill={LIGHT} radius={[2,2,0,0]}>
          <LabelList dataKey="2025" position="top"
            style={{ fontSize:10, fill:"#4a7fa5", fontWeight:700 }}
            formatter={v=>v!=null?formatter(v):""} />
        </Bar>
      )}
      {has26 && (
        <Bar dataKey="2026" fill={DARK} radius={[2,2,0,0]}>
          <LabelList dataKey="2026" position="top"
            style={{ fontSize:10, fill:DARK, fontWeight:700 }}
            formatter={v=>v!=null?formatter(v):""} />
        </Bar>
      )}
      <Legend wrapperStyle={{ fontSize:11, paddingTop:4 }} />
    </BarChart>
  );
}

/* ── SLIDES ───────────────────────────────────────────────────────────── */
function CoverSlide({ data }) {
  return (
    <Slide cover>
      <div style={{ marginTop:"auto" }}>
        <div style={{ fontSize:"5.5em", fontWeight:900, letterSpacing:-2, color:DARK,
          fontFamily:"sans-serif", lineHeight:1 }}>
          Host<span style={{ color:MID }}>ini</span>
        </div>
        <div style={{ marginTop:"6%" }}>
          <div style={{ fontSize:"1.8em", fontWeight:400, color:DARK }}>{data.clientName}</div>
          <div style={{ fontSize:"1.3em", fontStyle:"italic", color:"#6a8fa5", marginTop:"1%" }}>AirBnB</div>
          <div style={{ fontSize:"0.9em", color:"#8aacbc", marginTop:"3%" }}>{data.reportDate}</div>
        </div>
      </div>
    </Slide>
  );
}

function ChartSlide({ title, chartData, formatter, domain, bullets }) {
  return (
    <Slide>
      <SlideHeader title={title} />
      <div style={{ flex:1, display:"flex", alignItems:"center" }}>
        <ReportChart chartData={chartData} formatter={formatter} domain={domain} w={900} h={340} />
      </div>
      <BulletList bullets={bullets} />
    </Slide>
  );
}

function ListingsSlide({ data }) {
  const startIdx = Math.max(0, MONTHS_EN.indexOf(data.listingStartMonth || "Jan"));
  const count = Math.max(1, Math.min(12, Number(data.listingMonthsCount) || 4));
  const cols2026 = [];
  for (let i = 0; i < count; i += 1) {
    cols2026.push(MONTHS_EN[(startIdx + i) % MONTHS_EN.length]);
  }
  const listingsMap = (data.listings||[]).reduce((acc, l) => {
    if (l && l.id) acc[l.id] = l;
    return acc;
  }, {});

  const monthExtremes = cols2026.reduce((acc, m) => {
    const values = LISTINGS_META.map(meta => {
      const row = listingsMap[meta.id] || {};
      const v = row[m];
      return v && v > 0 ? v : null;
    }).filter(v => v != null);
    if (values.length < 2) {
      acc[m] = { min: null, max: null };
      return acc;
    }
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    acc[m] = (min === max) ? { min: null, max: null } : { min, max };
    return acc;
  }, {});
  return (
    <Slide>
      <div style={{ textAlign:"center", marginBottom:"2%" }}>
        <div style={{ fontSize:"1.7em", fontWeight:500, color:DARK, marginBottom:"0.5%" }}>
          Owners Revenue by listing
        </div>
        <div style={{ fontSize:"0.9em", color:"#6a6f75" }}>
          Prestation per lägenhet för korttidsuthyrningar
        </div>
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
        <table style={{ width:"96%", borderCollapse:"collapse", fontSize:"0.85em", marginLeft:0, marginRight:"auto" }}>
          <thead>
            <tr style={{ background:"#bcd0e1", borderBottom:"1px solid #c7cdd3" }}>
              <th style={{ textAlign:"left", padding:"1.2% 0.6%", color:DARK, fontWeight:600, width:"16%" }}>Lgh-nummer</th>
              <th style={{ textAlign:"left", padding:"1.2% 0.6%", color:DARK, fontWeight:600, width:"12%" }}>Area (m2)</th>
              {cols2026.map(m=>(
                <th key={m} style={{ textAlign:"right", padding:"1.2% 1%", color:DARK, fontWeight:600 }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LISTINGS_META.map((meta, i)=> {
              const row = listingsMap[meta.id] || {};
              return (
                <tr key={meta.id} style={{ background:i%2===0?"#f3f6f9":"white" }}>
                  <td style={{ padding:"1.6% 0.6%", fontWeight:600, color:DARK }}>{meta.id}</td>
                  <td style={{ textAlign:"left", padding:"1.6% 0.6%", color:DARK }}>{meta.area}</td>
                  {cols2026.map(m=>{
                    const v = row[m];
                    const extremes = monthExtremes[m] || { min: null, max: null };
                    const isBest = v != null && v > 0 && extremes.max != null && v === extremes.max;
                    const isWorst = v != null && v > 0 && extremes.min != null && v === extremes.min;
                    const ringStyle = isBest
                      ? { border:"2px solid #1ea86a", borderRadius:999, padding:"0.15em 0.45em", display:"inline-block" }
                      : isWorst
                        ? { border:"2px solid #e44", borderRadius:999, padding:"0.15em 0.45em", display:"inline-block" }
                        : null;
                    return (
                      <td key={m} style={{ textAlign:"right", padding:"1.6% 1%",
                        color:v?DARK:"#bbb" }}>
                        {v ? (
                          <span style={ringStyle || undefined}>{fmt(v)}</span>
                        ) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"2%" }}>
        <div style={{ fontSize:"0.75em", color:"#333", fontStyle:"italic" }}>
          NOTE: Total omsättning per lägenhet med bästa och sämsta prestation
        </div>
        <div style={{ fontSize:"0.85em", fontWeight:700, color:DARK }}>Hostini</div>
      </div>
    </Slide>
  );
}

function TotalSlide({ data }) {
  // Build monthly 2026 totals from aggregated revenue (CSV import)
  const monthly2026 = Object.assign({}, data.revenue2026 || {});

  // 2025 is only Dec from baseline
  const monthly2025 = Object.assign({}, data.revenue2025);

  const chartData = MONTHS_EN.map(m => ({
    month: m,
    "2025": monthly2025[m] || null,
    "2026": monthly2026[m] || null,
  }));

  const total2025 = Object.values(monthly2025).reduce((a,b)=>a+b,0);
  const total2026 = Object.values(monthly2026).reduce((a,b)=>a+b,0);

  return (
    <Slide>
      <SlideHeader title="Totala intäkter 2025 / 2026" />
      <div style={{ display:"flex", gap:"4%", alignItems:"center", justifyContent:"center", flex:1 }}>
        {/* Monthly chart */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
          <div style={{ fontSize:"0.72em", color:"#888", fontWeight:700, textTransform:"uppercase",
            letterSpacing:1, marginBottom:"2%" }}>Intäkter per månad</div>
          <ReportChart chartData={chartData} formatter={v=>`${Math.round(v/1000)}k`} w={600} h={300} />
        </div>
        {/* Summary cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:"4%", minWidth:"22%", justifyContent:"center" }}>
          <div style={{ fontSize:"0.72em", color:"#888", fontWeight:700, textTransform:"uppercase",
            letterSpacing:1, marginBottom:"1%" }}>Totalt</div>
          {[
            { label:"2025", value:total2025, color:LIGHT },
            { label:"2026", value:total2026, color:DARK },
          ].map(c=>(
            <div key={c.label} style={{ background:c.color, borderRadius:10,
              padding:"6% 8%", color:"white" }}>
              <div style={{ fontSize:"0.75em", opacity:0.8, marginBottom:"4%" }}>{c.label}</div>
              <div style={{ fontSize:"1.5em", fontWeight:800, lineHeight:1 }}>
                {Math.round(c.value).toLocaleString("sv-SE")}
              </div>
              <div style={{ fontSize:"0.65em", opacity:0.75, marginTop:"3%" }}>kr</div>
            </div>
          ))}
          {total2025>0 && total2026>0 && (
            <div style={{ background:"#f0f7fc", borderRadius:10, padding:"6% 8%",
              border:`1px solid ${LIGHT}` }}>
              <div style={{ fontSize:"0.72em", color:"#888", marginBottom:"4%" }}>Förändring</div>
              <div style={{ fontSize:"1.3em", fontWeight:800, color:total2026>total2025?GREEN:"#e44" }}>
                {total2026>total2025?"+":""}{Math.round(((total2026-total2025)/total2025)*100)}%
              </div>
            </div>
          )}
        </div>
      </div>
      <BulletList bullets={data.totalBullets} />
    </Slide>
  );
}

function QualitySlide({ data }) {
  const q = data.quality;
  const metrics = [
    { label:"Overall", icon:"🏆", value:q.overall },
    { label:"Cleanliness", icon:"🧴", value:q.cleanliness },
    { label:"Accuracy", icon:"✅", value:q.accuracy },
    { label:"Location", icon:"🗺️", value:q.location },
    { label:"Check In", icon:"🔑", value:q.checkIn },
    { label:"Communication", icon:"💬", value:q.communication },
    { label:"Value", icon:"🏷️", value:q.value },
  ];
  return (
    <Slide>
      <SlideHeader title="Quality Dashboard" />
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"2.5%", marginBottom:"2.5%" }}>
          {metrics.slice(0,4).map(m=>(
            <div key={m.label} style={{ border:"1px solid #d0e6f0", borderRadius:10, padding:"4% 5%",
              textAlign:"left" }}>
              <div style={{ fontSize:"1.4em", marginBottom:"8%" }}>{m.icon}</div>
              <div style={{ fontSize:"0.7em", color:"#888", marginBottom:"5%" }}>{m.label}</div>
              <div style={{ fontSize:"1.6em", fontWeight:800,
                color:m.value>=4.9?GREEN:DARK }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"2.5%",
          maxWidth:"76%" }}>
          {metrics.slice(4).map(m=>(
            <div key={m.label} style={{ border:"1px solid #d0e6f0", borderRadius:10, padding:"4% 5%",
              textAlign:"left" }}>
              <div style={{ fontSize:"1.4em", marginBottom:"8%" }}>{m.icon}</div>
              <div style={{ fontSize:"0.7em", color:"#888", marginBottom:"5%" }}>{m.label}</div>
              <div style={{ fontSize:"1.6em", fontWeight:800,
                color:m.value>=4.9?GREEN:DARK }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
      <BulletList bullets={data.qualityBullets} />
    </Slide>
  );
}

function ActionsSlide({ data }) {
  return (
    <Slide>
      <SlideHeader title="Reviews och åtgärder" />
      <div style={{ flex:1 }}>
        {data.actionsBullets.length===0
          ? <p style={{ color:"#aaa", fontSize:"0.8em" }}>Inga åtgärder — lägg till i Bullets-fliken.</p>
          : <ul style={{ listStyle:"none", padding:0, margin:0 }}>
              {data.actionsBullets.map((a,i)=>(
                <li key={i} style={{ display:"flex", gap:"2%", marginBottom:"3%",
                  alignItems:"flex-start" }}>
                  <div style={{ width:"1.6em", height:"1.6em", borderRadius:"50%", background:DARK,
                    color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.75em", flexShrink:0, marginTop:"0.1em" }}>{i+1}</div>
                  <div style={{ fontSize:"0.82em", color:"#333", lineHeight:1.55 }}>{a}</div>
                </li>
              ))}
            </ul>
        }
      </div>
    </Slide>
  );
}

/* ── PRINT DOCUMENT ───────────────────────────────────────────────────── */
const SLIDE_LABELS = [
  "Cover","Owners Revenue","Beläggning","ANR","Listings","Total Revenue","Quality","Actions"
];

function PrintDocument({ data }) {
  const revData   = MONTHS_EN.map(m=>({month:m,"2025":data.revenue2025[m]||null,"2026":data.revenue2026[m]||null}));
  const occData   = MONTHS_EN.map(m=>({month:m,"2025":data.occupancy2025[m]||null,"2026":data.occupancy2026[m]||null}));
  const anrData   = MONTHS_EN.map(m=>({month:m,"2025":data.anr2025[m]||null,"2026":data.anr2026[m]||null}));
  const total = 8;

  const slides = [
    <CoverSlide data={data} />,
    <ChartSlide title="Owners Revenue" chartData={revData}
      formatter={v=>`${Math.round(v/1000)}k`} bullets={data.revenueBullets} />,
    <ChartSlide title="Beläggning" chartData={occData}
      formatter={v=>`${v}%`} domain={[0,100]} bullets={data.occupancyBullets} />,
    <ChartSlide title="Average Nightly Rate" chartData={anrData}
      formatter={v=>`${v}`} bullets={data.anrBullets} />,
    <ListingsSlide data={data} />,
    <TotalSlide data={data} />,
    <QualitySlide data={data} />,
    <ActionsSlide data={data} />,
  ];

  return (
    <div id="print-root">
      {slides.map((slide, i) => (
        <div key={i}>{slide}</div>
      ))}
    </div>
  );
}

/* ── EDITOR ───────────────────────────────────────────────────────────── */
function BulletsEditor({ label, bullets, onChange }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#666", marginBottom:6,
        textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      {bullets.map((b,i)=>(
        <div key={i} style={{ display:"flex", gap:6, marginBottom:6 }}>
          <input value={b} onChange={e=>{ const a=bullets.slice(); a[i]=e.target.value; onChange(a); }}
            placeholder="Bullet point…"
            style={{ flex:1, padding:"5px 8px", borderRadius:5, border:"1.5px solid #c8dde8",
              fontSize:12, background:"#f7fbfd" }}/>
          <button onClick={()=>onChange(bullets.filter((_,j)=>j!==i))}
            style={{ background:"#e44", color:"white", border:"none", borderRadius:5,
              padding:"2px 8px", cursor:"pointer", fontSize:11 }}>✕</button>
        </div>
      ))}
      <button onClick={()=>onChange(bullets.concat([""]))}
        style={{ background:"#e8f4fa", color:DARK, border:`1px solid ${LIGHT}`,
          borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:11, width:"100%" }}>
        + Add bullet
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type="text" }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#666",
        marginBottom:3, textTransform:"uppercase", letterSpacing:1 }}>{label}</label>
      <input type={type} value={value}
        onChange={e=>onChange(type==="number"?Number(e.target.value):e.target.value)}
        style={{ width:"100%", padding:"6px 10px", borderRadius:6,
          border:"1.5px solid #c8dde8", fontFamily:"inherit", fontSize:13,
          background:"#f7fbfd", boxSizing:"border-box" }}/>
    </div>
  );
}

function MonthGrid({ label, data, onChange }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#666", marginBottom:6,
        textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
        {MONTHS_EN.map(m=>(
          <div key={m}>
            <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>{m}</div>
            <input type="number" value={data[m] == null ? "" : data[m]} placeholder="—"
              onChange={e=>{ const next=Object.assign({}, data); next[m]=e.target.value===""?undefined:Number(e.target.value); onChange(next); }}
              style={{ width:"100%", padding:"4px 6px", borderRadius:5,
                border:"1.5px solid #c8dde8", fontSize:12, background:"#f7fbfd",
                boxSizing:"border-box" }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorPanel({ data, setData }) {
  const [tab, setTab] = useState(0);
  const fileRef = useRef();
  const TABS = ["General","Bullets","Revenue","Occupancy","ANR","Quality"];
  const upd = (k,v) => setData(d=>{ const next=Object.assign({}, d); next[k]=v; return next; });

  const handleCSV = useCallback(e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const p=parseCSV(ev.target.result);
        setData(d=>Object.assign({}, d, p));
        alert(`✅ Imported! ${p.listings.length} listings · Total 2026: ${p.totalRevenue2026.toLocaleString("sv-SE")} kr`);
      } catch(err){ alert("❌ "+err.message); }
    };
    reader.readAsText(file); e.target.value="";
  },[setData]);

  return (
    <div style={{ fontFamily:"Manrope, sans-serif", fontSize:13 }}>
      {/* CSV */}
      <div onClick={()=>fileRef.current.click()}
        style={{ background:`linear-gradient(135deg,${DARK},${MID})`, color:"white",
          borderRadius:10, padding:14, marginBottom:16, cursor:"pointer", textAlign:"center",
          boxShadow:"0 2px 8px rgba(0,0,0,.15)" }}>
        <div style={{ fontSize:22, marginBottom:3 }}>📂</div>
        <div style={{ fontWeight:700, fontSize:13 }}>Upload CSV</div>
        <div style={{ fontSize:10, opacity:.75, marginTop:2 }}>Listing Performance export</div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display:"none" }}/>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:14 }}>
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)}
            style={{ padding:"4px 9px", borderRadius:20, border:"none", cursor:"pointer",
              fontSize:11, fontWeight:600,
              background:tab===i?DARK:"#dce8f0", color:tab===i?"white":DARK }}>
            {t}
          </button>
        ))}
      </div>

      {tab===0 && <React.Fragment>
        <Field label="Client Name" value={data.clientName} onChange={v=>upd("clientName",v)}/>
        <Field label="Report Date" value={data.reportDate} onChange={v=>upd("reportDate",v)}/>

        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#666", marginBottom:8,
            textTransform:"uppercase", letterSpacing:1 }}>Listings table months</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <label style={{ display:"block", fontSize:11, color:"#666", marginBottom:4 }}>Start month</label>
              <select value={data.listingStartMonth}
                onChange={e=>upd("listingStartMonth", e.target.value)}
                style={{ width:"100%", padding:"6px 8px", borderRadius:6, border:"1.5px solid #c8dde8",
                  background:"#f7fbfd", fontSize:12 }}>
                {MONTHS_EN.map(m=>(
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, color:"#666", marginBottom:4 }}>Number of months</label>
              <input type="number" min="1" max="12" value={data.listingMonthsCount}
                onChange={e=>upd("listingMonthsCount", Number(e.target.value))}
                style={{ width:"100%", padding:"6px 8px", borderRadius:6, border:"1.5px solid #c8dde8",
                  background:"#f7fbfd", fontSize:12, boxSizing:"border-box" }}/>
            </div>
          </div>
        </div>
      </React.Fragment>}

      {tab===1 && <React.Fragment>
        <div style={{ fontSize:11, color:"#888", marginBottom:12 }}>
          Bullet points appear below each chart in the PDF.
        </div>
        <BulletsEditor label="Owners Revenue" bullets={data.revenueBullets} onChange={v=>upd("revenueBullets",v)}/>
        <BulletsEditor label="Beläggning"     bullets={data.occupancyBullets} onChange={v=>upd("occupancyBullets",v)}/>
        <BulletsEditor label="ANR"            bullets={data.anrBullets} onChange={v=>upd("anrBullets",v)}/>
        <BulletsEditor label="Listings table" bullets={data.listingsBullets} onChange={v=>upd("listingsBullets",v)}/>
        <BulletsEditor label="Total Revenue"  bullets={data.totalBullets} onChange={v=>upd("totalBullets",v)}/>
        <BulletsEditor label="Quality"        bullets={data.qualityBullets} onChange={v=>upd("qualityBullets",v)}/>
        <BulletsEditor label="Actions"        bullets={data.actionsBullets} onChange={v=>upd("actionsBullets",v)}/>
      </React.Fragment>}

      {tab===2 && <React.Fragment>
        <MonthGrid label="Revenue 2025 (kr)" data={data.revenue2025} onChange={v=>upd("revenue2025",v)}/>
        <MonthGrid label="Revenue 2026 (kr)" data={data.revenue2026} onChange={v=>upd("revenue2026",v)}/>
      </React.Fragment>}

      {tab===3 && <React.Fragment>
        <MonthGrid label="Occupancy 2025 (%)" data={data.occupancy2025} onChange={v=>upd("occupancy2025",v)}/>
        <MonthGrid label="Occupancy 2026 (%)" data={data.occupancy2026} onChange={v=>upd("occupancy2026",v)}/>
      </React.Fragment>}

      {tab===4 && <React.Fragment>
        <MonthGrid label="ANR 2025 (kr)" data={data.anr2025} onChange={v=>upd("anr2025",v)}/>
        <MonthGrid label="ANR 2026 (kr)" data={data.anr2026} onChange={v=>upd("anr2026",v)}/>
      </React.Fragment>}

      {tab===5 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:7 }}>
          {["overall","cleanliness","accuracy","location","checkIn","communication","value"].map(f=>(
            <div key={f}>
              <div style={{ fontSize:10, color:"#888", marginBottom:2,
                textTransform:"capitalize" }}>{f}</div>
              <input type="number" step="0.01" min="1" max="5" value={data.quality[f]}
                onChange={e=>{ const nextQ=Object.assign({}, data.quality); nextQ[f]=Number(e.target.value); upd("quality", nextQ); }}
                style={{ width:"100%", padding:"4px 6px", borderRadius:5,
                  border:"1.5px solid #c8dde8", fontSize:12, background:"#f7fbfd",
                  boxSizing:"border-box" }}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── APP ──────────────────────────────────────────────────────────────── */
function App() {
  const [data, setData]           = useState(DEF);
  const [showEditor, setShowEditor] = useState(true);

  if(typeof document!=="undefined" && !document.getElementById("h-print-css")){
    const s=document.createElement("style"); s.id="h-print-css";
    s.textContent=PRINT_STYLE; document.head.appendChild(s);
  }

  return (
    <React.Fragment>
    <div className="screen-root" style={{ display:"flex", height:"100vh", fontFamily:"Manrope, sans-serif", background:"#dde3ea" }}>

      {showEditor && (
        <div style={{ width:300, minWidth:300, background:"white", overflowY:"auto",
          borderRight:"1px solid #d0e6f0", padding:16, boxSizing:"border-box" }}>
          <div style={{ fontWeight:800, fontSize:14, color:DARK, marginBottom:1 }}>Report Builder</div>
          <div style={{ fontSize:10, color:"#888", marginBottom:14 }}>Build → Download PDF</div>
          <EditorPanel data={data} setData={setData}/>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Toolbar */}
        <div className="no-print" style={{ background:DARK, padding:"10px 16px",
          display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setShowEditor(s=>!s)}
            style={{ background:"rgba(255,255,255,.15)", color:"white", border:"none",
              borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            {showEditor?"◀ Hide":"▶ Edit"}
          </button>
          <div style={{ flex:1 }}/>
          <button onClick={()=>window.print()}
            style={{ background:"white", color:DARK, border:"none", borderRadius:8,
              padding:"8px 22px", cursor:"pointer", fontSize:13, fontWeight:700,
              boxShadow:"0 2px 6px rgba(0,0,0,.15)", display:"flex", alignItems:"center", gap:8 }}>
            ⬇ Download PDF
          </button>
        </div>

        {/* Preview — each slide in its own white card with grey gap between */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px 0", background:"#dde3ea" }}>
          <div style={{ maxWidth:900, margin:"0 auto" }}>
            <div style={{ textAlign:"center", fontSize:11, color:"#8899aa", marginBottom:16 }}>
              Preview · {SLIDE_LABELS.length} slides · Click <strong>Download PDF</strong> to export
            </div>
            {[
              <CoverSlide data={data} />,
              <ChartSlide title="Owners Revenue"
                chartData={MONTHS_EN.map(m=>({month:m,"2025":data.revenue2025[m]||null,"2026":data.revenue2026[m]||null}))}
                formatter={v=>`${Math.round(v/1000)}k`} bullets={data.revenueBullets}/>,
              <ChartSlide title="Beläggning"
                chartData={MONTHS_EN.map(m=>({month:m,"2025":data.occupancy2025[m]||null,"2026":data.occupancy2026[m]||null}))}
                formatter={v=>`${v}%`} domain={[0,100]} bullets={data.occupancyBullets}/>,
              <ChartSlide title="Average Nightly Rate"
                chartData={MONTHS_EN.map(m=>({month:m,"2025":data.anr2025[m]||null,"2026":data.anr2026[m]||null}))}
                formatter={v=>`${v}`} bullets={data.anrBullets}/>,
              <ListingsSlide data={data} />,
              <TotalSlide data={data} />,
              <QualitySlide data={data} />,
              <ActionsSlide data={data} />,
            ].map((slide, i) => (
              <div key={i} style={{ marginBottom:12 }}>
                {/* Slide label strip */}
                <div style={{ background:"#b0bcc8", padding:"5px 14px",
                  borderRadius:"8px 8px 0 0", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", background:DARK,
                    color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:700 }}>{i+1}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:DARK,
                    textTransform:"uppercase", letterSpacing:1 }}>{SLIDE_LABELS[i]}</div>
                </div>
                {/* Slide itself in white card */}
                <div style={{ boxShadow:"0 4px 20px rgba(0,0,0,.13)", borderRadius:"0 0 8px 8px",
                  overflow:"hidden" }}>
                  {slide}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
    <PrintDocument data={data} />
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
