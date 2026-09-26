/* ============================================================
   collateral/lib/review-tools.mjs — pictures and numbers for reviewing a render without watching it.
     node collateral/lib/review-tools.mjs sheet <video> <out.png> [fps=2] [cols=8]   contact sheet
     node collateral/lib/review-tools.mjs audio <file> <out-prefix>                 spectrogram + waveform + loudness
   ============================================================ */
import { execFileSync, spawnSync } from "node:child_process";
import { FFMPEG } from "./reel-stage.mjs";

const [cmd, a, b, c, d] = process.argv.slice(2);
const ff = (args) => execFileSync(FFMPEG, ["-hide_banner", "-y", "-loglevel", "error", ...args]);
const ffErr = (args) => String(spawnSync(FFMPEG, ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }).stderr || "");

if (cmd === "sheet") {
  const fps = Number(c || 2), cols = Number(d || 8);
  const dur = Number((ffErr(["-i", a]).match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((s, v, i) => s + Number(v) * [3600, 60, 1][i], 0));
  // frames with ffmpeg (this build has no drawtext), labels and tiling with Pillow
  const tmp = `${b}.frames`; execFileSync("rm", ["-rf", tmp]); execFileSync("mkdir", ["-p", tmp]);
  ff(["-i", a, "-vf", `fps=${fps},scale=216:-1`, `${tmp}/%04d.png`]);
  execFileSync("python3", ["-c", `
import glob,sys
from PIL import Image, ImageDraw
fs=sorted(glob.glob(sys.argv[1]+'/*.png')); fps=float(sys.argv[3]); cols=int(sys.argv[4])
w,h=Image.open(fs[0]).size; rows=(len(fs)+cols-1)//cols
sheet=Image.new('RGB',(cols*w,rows*(h+22)),'white'); d=ImageDraw.Draw(sheet)
for i,f in enumerate(fs):
    x,y=(i%cols)*w,(i//cols)*(h+22); sheet.paste(Image.open(f).convert('RGB'),(x,y+22)); d.text((x+4,y+4),'%.2fs'%(i/fps+0.5/fps),fill='black')
sheet.save(sys.argv[2])`, tmp, b, String(fps), String(cols)]);
  execFileSync("rm", ["-rf", tmp]);
  console.log(`${b} (${cols} columns, ${dur.toFixed(2)} s at ${fps} fps)`);
} else if (cmd === "audio") {
  ff(["-i", a, "-lavfi", "showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log:color=intensity", `${b}-spectrum.png`]);
  ff(["-i", a, "-lavfi", "showwavespic=s=1600x300:split_channels=1:colors=0x1c6b56|0x75295c", `${b}-wave.png`]);
  const r = ffErr(["-i", a, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const S = r.slice(r.lastIndexOf("Summary:"));
  const pick = (re) => (S.match(re) || [])[1];
  console.log(JSON.stringify({ integratedLUFS: +pick(/I:\s+(-?[\d.]+) LUFS/), lra: +pick(/LRA:\s+([\d.]+) LU/), truePeak: +pick(/Peak:\s+(-?[\d.]+) dBFS/) }));
} else {
  console.error("usage: sheet <video> <out.png> [fps] [cols] | audio <file> <out-prefix>");
  process.exit(1);
}
