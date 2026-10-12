// Test segmentazione simultanea (stessa logica di VoiceApp).
const CONN = /(\s+e\s+poi\s+|\s+poi\s+|\s+e\s+|\s+dopo\s+|\s+quindi\s+|\s+allora\s+|,\s*)/i;
function cleanSeg(s) {
  return s
    .replace(/^\s*zen\b/i, "")
    .replace(/^\s*(e\s+poi|poi|e|dopo|quindi|allora)\b\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function segments(full) {
  const tokens = full.split(CONN);
  const out = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const seg = cleanSeg(tokens[i]);
    if (seg.length >= 2) out.push(seg);
  }
  return out;
}
const CASES = [
  "apri chrome e poi apri paint e disegnami una casa",
  "crea il file a.txt con dentro A, poi crea b.txt con dentro B",
  "zen dimmi che ore sono",
  "cerca TODO in src quindi scrivi il report",
  "alza il volume e dopo apri il blocco note",
  "apri chrome",
  "dimmi un numero e poi un altro e poi un altro ancora",
];
const t0 = Date.now();
for (const c of CASES) console.log(JSON.stringify(c), "=>", JSON.stringify(segments(c)));
console.log("SEGM-OK in " + (Date.now() - t0) + "ms");
