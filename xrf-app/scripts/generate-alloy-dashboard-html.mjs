import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const extractedDir = path.resolve(appRoot, "..", "extracted");
const outputFile = path.resolve(appRoot, "public", "alloy-dashboard.html");
const elements = ["C", "Mn", "Si", "P", "S", "Cr", "Ni", "Mo"];

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]));
  });
}

function firstValue(row, prefixes) {
  for (const prefix of prefixes) {
    const key = Object.keys(row).find((candidate) => candidate === prefix || candidate.startsWith(prefix));
    const value = key ? row[key] : "";
    if (value && value !== "---") return value;
  }
  return "";
}

function normalizeLimit(value) {
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return cleaned && Number.isFinite(parsed) ? parsed : null;
}

function parseRange(rawValue) {
  const raw = rawValue.trim();
  if (!raw || raw === "---") return { raw: "", min: null, max: null };
  const normalized = raw.replace(/[–—]/g, "-").replace(/\s+/g, "");
  const match = normalized.match(/^([<>≤≥]?\d+(?:[.,]\d+)?)-([<>≤≥]?\d+(?:[.,]\d+)?)$/);
  if (match) return { raw, min: normalizeLimit(match[1]), max: normalizeLimit(match[2]) };
  const single = normalizeLimit(normalized);
  return /^(?:>|≥)/.test(normalized) ? { raw, min: single, max: null } : { raw, min: null, max: single };
}

function familyFromSection(section) {
  const text = section.toLowerCase();
  if (text.includes("stainless")) return "Aços inoxidáveis";
  if (text.includes("carbon")) return "Aços carbono";
  if (text.includes("alloy")) return "Aços ligados";
  if (text.includes("tool")) return "Aços ferramenta";
  if (text.includes("bearing")) return "Aços para rolamentos";
  if (text.includes("spring")) return "Aços mola";
  if (text.includes("cast")) return "Aços fundidos";
  if (text.includes("forging")) return "Forjados";
  return "Outras ligas";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function buildDatabase() {
  const files = fs.readdirSync(extractedDir).filter((file) => file.endsWith(".csv")).sort();
  const alloys = [];

  for (const file of files) {
    const rows = parseCsv(fs.readFileSync(path.join(extractedDir, file), "utf8"));
    rows.forEach((row, rowIndex) => {
      const section = row.Section || "Sem seção";
      const standard = firstValue(row, ["Standard Designation"]);
      const grade = firstValue(row, ["Grade, Class, Type, Symbol or Name", "Grade, Class, Type, Symbol, or Name"]);
      const steelNumber = firstValue(row, ["Steel Number"]);
      const unsNumber = firstValue(row, ["UNS Number"]);
      const thicknessMm = row["Section Thickness t, mm"] ?? "";
      const thicknessIn = row["t, in."] ?? "";
      const others = row.Others ?? "";

      alloys.push({
        id: `${file}-${rowIndex}`,
        sourceFile: file,
        section,
        chapter: section.match(/^(\d+(?:\.\d+)?[A-Z]?)/)?.[1] ?? "Sem capítulo",
        family: familyFromSection(section),
        standard,
        grade,
        steelNumber,
        unsNumber,
        thicknessMm,
        thicknessIn,
        elements: Object.fromEntries(elements.map((element) => [element, parseRange(row[element] ?? "")])),
        others,
        searchText: [section, standard, grade, steelNumber, unsNumber, thicknessMm, thicknessIn, others, file]
          .join(" ")
          .toLowerCase(),
      });
    });
  }

  return {
    alloys,
    elements,
    families: unique(alloys.map((alloy) => alloy.family)),
    chapters: unique(alloys.map((alloy) => alloy.chapter)),
    totalFiles: files.length,
  };
}

const database = buildDatabase();
const serializedDatabase = JSON.stringify(database).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Banco de Ligas Metálicas | Preview HTML</title>
  <style>
    :root{--blue:#2563eb;--ink:#0f172a;--muted:#64748b;--line:#dbe4ef}*{box-sizing:border-box}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:radial-gradient(circle at 0 0,#2563eb2e,transparent 32rem),linear-gradient(135deg,#f8fafc,#eef4ff 48%,#f8fafc)}
    main{min-height:100vh;padding:32px}.shell{max-width:1440px;margin:auto}.hero{display:grid;grid-template-columns:1fr 330px;gap:24px;margin-bottom:18px}
    .badge{display:inline-flex;margin-bottom:14px;border:1px solid #2563eb2e;border-radius:999px;padding:6px 12px;color:#1d4ed8;background:#2563eb14;font-size:12px;font-weight:800;text-transform:uppercase}
    h1{max-width:900px;margin:0;font-size:clamp(38px,4.6vw,64px);line-height:1;letter-spacing:-.045em}.subtitle{max-width:900px;margin:12px 0 0;color:#2563eb;font-size:clamp(20px,2.4vw,32px);line-height:1.15;letter-spacing:-.025em}.hero p{max-width:780px;color:#526173;font-size:18px;line-height:1.7}
    .card,.panel,.metric{border:1px solid #94a3b847;border-radius:28px;background:#ffffffdb;box-shadow:0 24px 80px #0f172a14}.card{display:flex;flex-direction:column;justify-content:flex-end;padding:28px}
    .card strong{color:var(--blue);font-size:56px}.card span{margin:12px 0 8px;font-size:18px;font-weight:800}.muted,.card small{color:var(--muted)}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}.metric{padding:22px}.metric strong{display:block;font-size:30px}.metric span{color:var(--muted);font-size:14px;font-weight:700}
    .panel{padding:20px;margin-bottom:16px}.filters{display:grid;grid-template-columns:2fr repeat(5,minmax(120px,1fr));gap:14px}label{display:grid;gap:8px;color:#475569;font-size:12px;font-weight:800;text-transform:uppercase}
    input,select{width:100%;border:1px solid var(--line);border-radius:14px;padding:13px 14px;background:#fff;font:inherit}.grid{display:grid;grid-template-columns:330px 1fr;gap:16px}
    h2{margin:0 0 16px}.bars{display:grid;gap:12px}.bar{display:grid;gap:8px;border:0;border-radius:18px;padding:12px;background:#f8fafc;text-align:left;cursor:pointer}.bar:hover,.bar.active{background:#eaf1ff}
    .track{overflow:hidden;height:8px;border-radius:999px;background:#e2e8f0}.fill{display:block;height:100%;background:linear-gradient(90deg,#2563eb,#06b6d4)}
    .table-head{display:flex;align-items:center;justify-content:space-between}.table-wrap{overflow:auto;max-height:680px;border:1px solid #e2e8f0;border-radius:18px;background:#fff}
    table{width:100%;min-width:1120px;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:12px 14px;font-size:13px;text-align:left;white-space:nowrap}
    th{position:sticky;top:0;background:#f8fafc;font-size:11px;text-transform:uppercase}tbody tr{cursor:pointer}tbody tr:hover,tbody tr.selected{background:#eff6ff}td strong,td small{display:block}td small{color:var(--muted)}
    .detail{display:grid;grid-template-columns:1fr 2fr;gap:24px;margin-top:16px}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:0}dl>div{border-radius:16px;padding:14px;background:#f8fafc}dt{color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase}dd{margin:6px 0 0;font-weight:700;overflow-wrap:anywhere}
    @media(max-width:1100px){.hero,.grid,.detail{grid-template-columns:1fr}.metrics,.filters,dl{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){main{padding:18px}.metrics,.filters,dl{grid-template-columns:1fr}}
  </style>
</head>
<body><main><div class="shell">
  <section class="hero"><div><span class="badge">Preview HTML estático</span><h1>Consulta de ligas metálicas</h1><h2 class="subtitle">Handbook of Comparative World Steel Standards</h2><p>Arquivo HTML autônomo gerado da pasta <strong>extracted/</strong>. Use a busca e os filtros para explorar as ligas sem iniciar o Next.js.</p></div><div class="card"><strong id="total">0</strong><span>ligas e especificações indexadas</span></div></section>
  <section class="metrics"><div class="metric"><strong id="filtered">0</strong><span>resultados filtrados</span></div><div class="metric"><strong id="standards">0</strong><span>designações/normas</span></div><div class="metric"><strong id="uns">0</strong><span>UNS identificados</span></div><div class="metric"><strong id="elementCount">0</strong><span>elementos principais</span></div></section>
  <section class="panel"><div class="filters"><label>Busca global<input id="query" placeholder="ASTM A 240, 316, S30400"></label><label>Família<select id="family"></select></label><label>Capítulo<select id="chapter"></select></label><label>Elemento<select id="element"></select></label><label>Mín. %<input id="min" type="number" step=".01"></label><label>Máx. %<input id="max" type="number" step=".01"></label></div></section>
  <section class="grid"><aside class="panel"><h2>Distribuição por família</h2><div id="bars" class="bars"></div></aside><section class="panel"><div class="table-head"><h2>Resultados</h2><span id="showing" class="muted"></span></div><div class="table-wrap"><table><thead id="thead"></thead><tbody id="tbody"></tbody></table></div></section></section>
  <section id="detail" class="card detail"></section>
</div></main>
<script id="data" type="application/json">${serializedDatabase}</script>
<script>
const db=JSON.parse(document.getElementById("data").textContent),state={query:"",family:"Todos",chapter:"Todos",element:"Cr",min:"",max:"",selected:db.alloys[0]?.id??""},$=id=>document.getElementById(id),fmt=new Intl.NumberFormat("pt-BR");
const esc=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function options(id,values,all=true){$(id).innerHTML=(all?"<option>Todos</option>":"")+values.map(value=>"<option>"+esc(value)+"</option>").join("")}
function matches(alloy){const query=state.query.trim().toLowerCase(),range=alloy.elements[state.element],min=state.min===""?null:Number(state.min),max=state.max===""?null:Number(state.max),rangeMin=range?.min??0,rangeMax=range?.max??range?.min??0;return(!query||alloy.searchText.includes(query))&&(state.family==="Todos"||alloy.family===state.family)&&(state.chapter==="Todos"||alloy.chapter===state.chapter)&&((min===null&&max===null)||!!range?.raw&&(min===null||rangeMax>=min)&&(max===null||rangeMin<=max))}
function render(){const rows=db.alloys.filter(matches),visible=rows.slice(0,250);$("total").textContent=fmt.format(db.alloys.length);$("filtered").textContent=fmt.format(rows.length);$("standards").textContent=fmt.format(new Set(rows.map(item=>item.standard).filter(Boolean)).size);$("uns").textContent=fmt.format(new Set(rows.map(item=>item.unsNumber).filter(Boolean)).size);$("elementCount").textContent=db.elements.length;$("showing").textContent="Mostrando "+visible.length+" de "+rows.length;
$("bars").innerHTML=db.families.map(name=>({name,count:db.alloys.filter(item=>item.family===name).length})).sort((a,b)=>b.count-a.count).map(item=>'<button class="bar '+(state.family===item.name?"active":"")+'" data-family="'+esc(item.name)+'"><strong>'+esc(item.name)+'</strong><div class="track"><i class="fill" style="width:'+(item.count/db.alloys.length*100)+'%"></i></div><small>'+item.count+'</small></button>').join("");
$("thead").innerHTML='<tr><th rowspan="2">Grau / Tipo</th><th rowspan="2">Norma</th><th rowspan="2">UNS</th><th rowspan="2">Família</th>'+db.elements.map(item=>'<th colspan="2" style="text-transform:none;text-align:center">'+item+'</th>').join("")+'</tr><tr>'+db.elements.map(()=>'<th style="text-align:center">Mín.</th><th style="text-align:center">Máx.</th>').join("")+"</tr>";
$("tbody").innerHTML=visible.map(alloy=>'<tr data-id="'+esc(alloy.id)+'" class="'+(state.selected===alloy.id?"selected":"")+'"><td><strong>'+esc(alloy.grade||"—")+'</strong><small>'+esc(alloy.steelNumber||alloy.chapter)+'</small></td><td>'+esc(alloy.standard||"—")+'</td><td>'+esc(alloy.unsNumber||"—")+'</td><td>'+esc(alloy.family)+'</td>'+db.elements.map(item=>{const range=alloy.elements[item];return"<td>"+esc(range?.min??"—")+"</td><td>"+esc(range?.max??"—")+"</td>"}).join("")+"</tr>").join("");
document.querySelectorAll(".bar").forEach(button=>button.onclick=()=>{state.family=button.dataset.family;$("family").value=state.family;render()});document.querySelectorAll("tbody tr").forEach(row=>row.onclick=()=>{state.selected=row.dataset.id;render()});
const selected=db.alloys.find(item=>item.id===state.selected)||visible[0];if(selected){state.selected=selected.id;$("detail").innerHTML='<div><span class="badge">Ficha técnica</span><h2>'+esc(selected.grade||selected.standard||"Liga selecionada")+'</h2><p>'+esc(selected.section)+'</p></div><dl><div><dt>Norma</dt><dd>'+esc(selected.standard||"—")+'</dd></div><div><dt>Steel number</dt><dd>'+esc(selected.steelNumber||"—")+'</dd></div><div><dt>UNS</dt><dd>'+esc(selected.unsNumber||"—")+'</dd></div><div><dt>Outros</dt><dd>'+esc(selected.others||"—")+'</dd></div></dl>'}}
options("family",db.families);options("chapter",db.chapters);options("element",db.elements,false);$("element").value=state.element;["query","family","chapter","element","min","max"].forEach(id=>$(id).oninput=event=>{state[id]=event.target.value;render()});render();
</script></body></html>`;

fs.writeFileSync(outputFile, html);
console.log(`Generated ${path.relative(appRoot, outputFile)} with ${database.alloys.length} alloys from ${database.totalFiles} CSV files.`);
