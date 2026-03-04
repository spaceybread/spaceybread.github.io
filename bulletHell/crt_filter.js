let canvas = null;
let ctx = null;
let _crtOffscreen = null;
let _crtCtx = null;

export function initCRT(c, context) {
    canvas = c;
    ctx = context;
}

function _ensureCRTCanvas() {
    if (_crtOffscreen && _crtOffscreen.width === canvas.width && _crtOffscreen.height === canvas.height) return;
    _crtOffscreen = document.createElement("canvas");
    _crtOffscreen.width  = canvas.width;
    _crtOffscreen.height = canvas.height;
    _crtCtx = _crtOffscreen.getContext("2d");
}

export function drawCRTFilter() {
    if (!canvas || !ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const now = performance.now() * 0.001;

    _ensureCRTCanvas();
    _crtCtx.clearRect(0, 0, W, H);

    const lineSpacing = 4;
    _crtCtx.fillStyle = "rgba(0,0,0,0.07)";
    for (let y = 0; y < H; y += lineSpacing) {
        _crtCtx.fillRect(0, y, W, 1);
    }

    const bandY = ((now * 0.07) % 1) * H;
    const bandGrad = _crtCtx.createLinearGradient(0, bandY - 30, 0, bandY + 30);
    bandGrad.addColorStop(0,   "rgba(255,255,255,0)");
    bandGrad.addColorStop(0.5, "rgba(255,255,255,0.012)");
    bandGrad.addColorStop(1,   "rgba(255,255,255,0)");
    _crtCtx.fillStyle = bandGrad;
    _crtCtx.fillRect(0, bandY - 30, W, 60);

    const vig = _crtCtx.createRadialGradient(W/2, H/2, H*0.38, W/2, H/2, H*0.82);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.48)");
    _crtCtx.fillStyle = vig;
    _crtCtx.fillRect(0, 0, W, H);

    const flicker = 0.005 * Math.sin(now * 73.1) * Math.sin(now * 29.3);
    if (flicker > 0) {
        _crtCtx.fillStyle = `rgba(255,255,255,${flicker})`;
        _crtCtx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(_crtOffscreen, 0, 0);
    ctx.restore();

    const aberration = 1.2;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.07;
    ctx.drawImage(canvas, -aberration, 0, W, H, 0, 0, W, H);
    ctx.drawImage(canvas,  aberration, 0, W, H, 0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.022;
    ctx.fillStyle = "#00ffcc";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const edgeGrad = ctx.createLinearGradient(0, 0, 0, H);
    edgeGrad.addColorStop(0,   "rgba(100,30,160,0.07)");
    edgeGrad.addColorStop(0.15,"rgba(0,0,0,0)");
    edgeGrad.addColorStop(0.85,"rgba(0,0,0,0)");
    edgeGrad.addColorStop(1,   "rgba(100,30,160,0.07)");
    ctx.save();
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}