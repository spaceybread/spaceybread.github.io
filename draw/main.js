let session = null;

async function loadModels() {
  try {
    session = await ort.InferenceSession.create('model.onnx');
    document.getElementById('loadingOverlay').classList.remove('visible');
    document.getElementById('predictBtn').disabled = false;
    initResultRows();
  } catch(e) {
    console.error(e);
    document.getElementById('loadingOverlay').classList.remove('visible');
    document.getElementById('errorMsg').classList.add('visible');
  }
}

async function predict(pixels) {
  const input = new ort.Tensor('float32', Float32Array.from(pixels), [1, 1, 28, 28]);
  const results = await session.run({ input });
  const output = results.output.data;
  const max = Math.max(...output);
  const exps = Array.from(output).map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvasWrapper');
let drawing = false;
let hasDrawing = false;

ctx.fillStyle = '#000';
ctx.fillRect(0, 0, 280, 280);
ctx.strokeStyle = '#fff';
ctx.lineWidth = 4;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

canvas.addEventListener('mousedown', e => {
  drawing = true;
  const p = getPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const p = getPos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  if (!hasDrawing) {
    hasDrawing = true;
    wrapper.classList.add('has-drawing');
  }
});

canvas.addEventListener('mouseup', () => { drawing = false; });
canvas.addEventListener('mouseleave', () => { drawing = false; });

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  drawing = true;
  const p = getPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!drawing) return;
  const p = getPos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  if (!hasDrawing) {
    hasDrawing = true;
    wrapper.classList.add('has-drawing');
  }
}, { passive: false });

canvas.addEventListener('touchend', () => { drawing = false; });

document.getElementById('clearBtn').addEventListener('click', () => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 280, 280);
  hasDrawing = false;
  wrapper.classList.remove('has-drawing');
  resetResults();
  document.getElementById('predBadge').classList.remove('visible');
});

function getPixels() {
  const imageData = ctx.getImageData(0, 0, 280, 280);
  let minX = 280, minY = 280, maxX = 0, maxY = 0;

  for (let y = 0; y < 280; y++) {
    for (let x = 0; x < 280; x++) {
      const i = (y * 280 + x) * 4;
      if (imageData.data[i] > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = 20;
  const srcX = Math.max(0, minX - pad);
  const srcY = Math.max(0, minY - pad);
  const srcW = Math.min(280, maxX + pad) - srcX;
  const srcH = Math.min(280, maxY + pad) - srcY;

  const offscreen = document.createElement('canvas');
  offscreen.width  = 28;
  offscreen.height = 28;
  const octx = offscreen.getContext('2d');
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, 28, 28);
  octx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, 28, 28);

  const data = octx.getImageData(0, 0, 28, 28).data;
  return Array.from({ length: 28 * 28 }, (_, i) => data[i * 4] / 255.0);
}
function debugPixels() {
  const pixels = getPixels();
  const debug = document.createElement('canvas');
  debug.width = 28;
  debug.height = 28;
  debug.style = 'width:112px;height:112px;image-rendering:pixelated;border:1px solid red;position:fixed;bottom:10px;right:10px;';
  const dctx = debug.getContext('2d');
  const img = dctx.createImageData(28, 28);
  for (let i = 0; i < 28 * 28; i++) {
    const v = pixels[i] * 255;
    img.data[i * 4]     = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  dctx.putImageData(img, 0, 0);
  const old = document.getElementById('debugCanvas');
  if (old) old.remove();
  debug.id = 'debugCanvas';
  document.body.appendChild(debug);
}

function initResultRows() {
  const panel = document.getElementById('resultsPanel');
  panel.innerHTML = '';
  for (let d = 0; d < 10; d++) {
    const row = document.createElement('div');
    row.className = 'result-row';
    row.id = `row-${d}`;
    row.innerHTML = `
      <div class="digit-label">${d}</div>
      <div class="bar-track"><div class="bar-fill" id="bar-${d}"></div></div>
      <div class="pct-label" id="pct-${d}">—</div>
    `;
    panel.appendChild(row);
  }
}

function resetResults() {
  for (let d = 0; d < 10; d++) {
    document.getElementById(`bar-${d}`).style.width = '0%';
    document.getElementById(`pct-${d}`).textContent = '—';
    document.getElementById(`row-${d}`).className = 'result-row';
  }
}

function showResults(probs) {
  const sorted = [...probs].map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  for (let d = 0; d < 10; d++) {
    document.getElementById(`bar-${d}`).style.width = `${probs[d] * 100}%`;
    document.getElementById(`pct-${d}`).textContent = `${(probs[d] * 100).toFixed(1)}%`;
    document.getElementById(`row-${d}`).className = 'result-row';
  }
  document.getElementById(`row-${sorted[0].i}`).classList.add('top-pick');
  document.getElementById(`row-${sorted[1].i}`).classList.add('second-pick');

  document.getElementById('predNumber').textContent = sorted[0].i;
  document.getElementById('predConf').textContent = `${(sorted[0].p * 100).toFixed(1)}% confidence`;
  document.getElementById('predBadge').classList.add('visible');
}

document.getElementById('predictBtn').addEventListener('click', async () => {
  if (!session) return;
  const pixels = getPixels();
  // debugPixels();
  const probs = await predict(pixels);
  showResults(probs);
});

loadModels();
initResultRows();