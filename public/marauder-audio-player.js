(function () {
  if (document.getElementById("mrd-mini-player")) return;

  const box = document.createElement("div");
  box.id = "mrd-mini-player";
  box.style.cssText = [
    "position:fixed",
    "right:14px",
    "bottom:14px",
    "z-index:99999",
    "width:290px",
    "background:#0d1017",
    "border:1px solid #ef4444",
    "border-radius:10px",
    "padding:10px 12px",
    "color:#f9fafb",
    "font-family:system-ui,sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,0.65)"
  ].join(";");

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <strong style="font-size:12px;letter-spacing:.08em;color:#f87171">MARAUDER // AUDIO DECK</strong>
      <button id="mrd-mp-hide" type="button" style="background:none;border:0;color:#9ca3af;cursor:pointer;font-weight:700">×</button>
    </div>
    <div id="mrd-mp-track" style="font-size:12px;color:#d1d5db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px">Избери MP3 / WAV файл от диска...</div>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
      <button id="mrd-mp-toggle" type="button" style="padding:6px 12px;border-radius:6px;border:0;background:#dc2626;color:#fff;font-weight:700;cursor:pointer">PLAY</button>
      <input id="mrd-mp-file" type="file" accept="audio/*" style="font-size:11px;max-width:190px;color:#9ca3af" />
    </div>
    <input id="mrd-mp-vol" type="range" min="0" max="1" step="0.05" value="0.7" style="width:100%" />
    <audio id="mrd-mp-audio"></audio>
  `;

  document.body.appendChild(box);

  const audio = document.getElementById("mrd-mp-audio");
  const toggle = document.getElementById("mrd-mp-toggle");
  const fileInp = document.getElementById("mrd-mp-file");
  const trackEl = document.getElementById("mrd-mp-track");
  const volInp = document.getElementById("mrd-mp-vol");
  const hideBtn = document.getElementById("mrd-mp-hide");

  audio.volume = 0.7;

  fileInp.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    audio.src = URL.createObjectURL(f);
    trackEl.textContent = f.name;
    audio.play().catch(() => {});
  });

  toggle.addEventListener("click", () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", () => { toggle.textContent = "PAUSE"; });
  audio.addEventListener("pause", () => { toggle.textContent = "PLAY"; });
  volInp.addEventListener("input", () => { audio.volume = Number(volInp.value); });
  hideBtn.addEventListener("click", () => { box.style.display = "none"; });
})();
