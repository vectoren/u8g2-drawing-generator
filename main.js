//alert('Before usage read manual');

const WIDTH = 32;
const HEIGHT = 32;
let paint = true;
let isMouseDown = false;
let draggingMode = 'paint';
const gridContainer = document.getElementById('gridContainer');
const codeBox = document.getElementById('codeBox');
const prefixInput = document.getElementById('prefix');
const suffixInput = document.getElementById('suffix');
const orderSel = document.getElementById('orderSel');
const defaultCellSize = 16;
const modeLabel = document.getElementById('mode');
// origin / relative output support
let origin = null; // [x, y]
let originCell = null;
let awaitingOrigin = false;
const outputModeRadios = document.getElementsByName('outputMode');
const originDisplay = document.getElementById('originDisplay');

function getOutputMode() {
    if (!outputModeRadios) return 'normal';
    for (let i = 0; i < outputModeRadios.length; i++) {
        if (outputModeRadios[i].checked) return outputModeRadios[i].value;
    }
    return 'normal';
}

function buildGrid(cellSize) {
    gridContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = `repeat(${WIDTH}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${HEIGHT}, ${cellSize}px)`;
    grid.style.gap = 'var(--grid-gap)';
    grid.style.width = `540px`;
    grid.style.height = `540px`;
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const c = document.createElement('div');
            c.className = 'cell';
            c.dataset.x = x;
            c.dataset.y = y;
            c.title = `${x}, ${y}`;
            c.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                
                if (awaitingOrigin) {
                    setOriginCell(c);
                    awaitingOrigin = false;
                    return;
                }
                isMouseDown = true;
                if (ev.button === 2) {
                    draggingMode = 'erase';
                    setCell(c, false);
                } else {
                    draggingMode = 'paint';
                    setCell(c, !c.classList.contains('on'));
                }
            });
            c.addEventListener('mouseenter', (ev) => {
                if (isMouseDown) {
                    if (draggingMode === 'paint') setCell(c, true);
                    else setCell(c, false);
                }
            });
            c.addEventListener('mouseup', () => {
                isMouseDown = false;
            });
            c.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                setCell(c, false);
            });
            grid.appendChild(c);
        }
    }
    gridContainer.appendChild(grid);
}

function setCell(el, on) {
    if (on) el.classList.add('on');
    else el.classList.remove('on');
}

document.body.addEventListener('mouseup', () => {
    isMouseDown = false;
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.querySelectorAll('.cell.on').forEach(c => c.classList.remove('on'));
    codeBox.value = '';
});

document.getElementById('invertBtn').addEventListener('click', () => {
    document.querySelectorAll('.cell').forEach(c => c.classList.toggle('on'));
});

document.getElementById('randomBtn').addEventListener('click', () => {
    document.querySelectorAll('.cell').forEach(c => setCell(c, Math.random() > 0.8));
});

document.getElementById('genBtn').addEventListener('click', () => {
    const prefix = prefixInput.value || 'u8g2.drawPixel(';
    const suffix = suffixInput.value || ');';
    let points = [];
    document.querySelectorAll('.cell.on').forEach(c => points.push([parseInt(c.dataset.x), parseInt(c.dataset.y)]));
    const order = orderSel.value;
    if (order === 'byY') points.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    else if (order === 'byX') points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    
    // helper to format x/y expressions for relative/variable modes
    function formatCoord(base, delta) {
        if (delta === 0) return `${base}`;
        return delta > 0 ? `${base}+${delta}` : `${base}-${Math.abs(delta)}`;
    }

    const mode = getOutputMode();
    // if relative/variable require origin
    if ((mode === 'relative' || mode === 'variable') && !origin) {
        alert(`Please set an origin for ${mode} mode.`);
        return;
    }

    // detect contiguous horizontal/vertical runs and pixels
    const cmds = detectLines(points);
    const outLines = [];

    for (const cmd of cmds) {
        if (cmd.type === 'pixel') {
            if (mode === 'normal') outLines.push(`${prefix}${cmd.x}, ${cmd.y}${suffix}`);
            else {
                const baseX = mode === 'variable' ? 'x' : origin[0];
                const baseY = mode === 'variable' ? 'y' : origin[1];
                const xExpr = formatCoord(baseX, cmd.x - origin[0]);
                const yExpr = formatCoord(baseY, cmd.y - origin[1]);
                outLines.push(`${prefix}${xExpr}, ${yExpr}${suffix}`);
            }
        } else if (cmd.type === 'hline') {
            // use drawHLine(x, y, w)
            if (mode === 'normal') {
                outLines.push(`u8g2.drawHLine(${cmd.x}, ${cmd.y}, ${cmd.w}${suffix}`);
            } else {
                const baseX = mode === 'variable' ? 'x' : origin[0];
                const baseY = mode === 'variable' ? 'y' : origin[1];
                const xExpr = formatCoord(baseX, cmd.x - origin[0]);
                const yExpr = formatCoord(baseY, cmd.y - origin[1]);
                outLines.push(`u8g2.drawHLine(${xExpr}, ${yExpr}, ${cmd.w}${suffix}`);
            }
        } else if (cmd.type === 'vline') {
            // use drawVLine(x, y, w)
            if (mode === 'normal') {
                outLines.push(`u8g2.drawVLine(${cmd.x}, ${cmd.y}, ${cmd.w}${suffix}`);
            } else {
                const baseX = mode === 'variable' ? 'x' : origin[0];
                const baseY = mode === 'variable' ? 'y' : origin[1];
                const xExpr = formatCoord(baseX, cmd.x - origin[0]);
                const yExpr = formatCoord(baseY, cmd.y - origin[1]);
                outLines.push(`u8g2.drawVLine(${xExpr}, ${yExpr}, ${cmd.w}${suffix}`);
            }
        }
    }

    codeBox.value = outLines.join('\n');
    
});

document.getElementById('importBtn').addEventListener('click', () => {
    document.querySelectorAll('.cell.on').forEach(c => c.classList.remove('on'));
    const prefix = prefixInput.value || 'u8g2.drawPixel(';
    const suffix = suffixInput.value || ');';
    const text = codeBox.value || '';
    if (!text.trim()) return;

    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedPoints = [];
    let foundExpression = false;

    const tryParseCoord = (coordStr) => {
        coordStr = coordStr.trim();
        
        if (/^-?\d+$/.test(coordStr)) return { type: 'number', value: parseInt(coordStr, 10) };
        
        const m = coordStr.match(/^([A-Za-z_][\w]*|-?\d+)\s*([+-])\s*(\d+)$/);
        if (m) {
            const base = m[1];
            const op = m[2];
            const n = parseInt(m[3], 10);
            if (/^-?\d+$/.test(base)) {
                const baseNum = parseInt(base, 10);
                return { type: 'number', value: op === '+' ? baseNum + n : baseNum - n };
            }
            foundExpression = true;
            return { type: 'variableExpr', base: base, op: op, n: n };
        }
        const m2 = coordStr.match(/^([A-Za-z_][\w]*)$/);
        if (m2) {
            foundExpression = true;
            return { type: 'variableExpr', base: m2[1], op: null, n: 0 };
        }
        return null;
    };

    for (const line of rawLines) {
        // try parse HLine/VLine first (allow variations like u8g2.drawHLine(...))
        const hmatch = line.match(/drawHLine\s*\(([^)]*)\)/i);
        const vmatch = line.match(/drawVLine\s*\(([^)]*)\)/i);
        if (hmatch) {
            const args = hmatch[1].split(',').map(a => a.trim());
            if (args.length >= 3) {
                const xInfo = tryParseCoord(args[0]);
                const yInfo = tryParseCoord(args[1]);
                const wInfo = tryParseCoord(args[2]);
                if (!xInfo || !yInfo || !wInfo) continue;
                parsedPoints.push({ type: 'hline', xInfo, yInfo, wInfo });
                continue;
            }
        }
        if (vmatch) {
            const args = vmatch[1].split(',').map(a => a.trim());
            if (args.length >= 3) {
                const xInfo = tryParseCoord(args[0]);
                const yInfo = tryParseCoord(args[1]);
                const wInfo = tryParseCoord(args[2]);
                if (!xInfo || !yInfo || !wInfo) continue;
                parsedPoints.push({ type: 'vline', xInfo, yInfo, wInfo });
                continue;
            }
        }

        // fallback: try parsing as drawPixel-like or "x, y"
        let s = line;
        if (s.startsWith(prefix)) s = s.slice(prefix.length);
        if (s.endsWith(suffix)) s = s.slice(0, s.length - suffix.length);
        const parts = s.split(',');
        if (parts.length < 2) continue;
        const xStr = parts[0].trim();
        const yStr = parts.slice(1).join(',').trim();
        const xInfo = tryParseCoord(xStr);
        const yInfo = tryParseCoord(yStr);
        if (!xInfo || !yInfo) continue;
        parsedPoints.push({ type: 'pixel', xInfo, yInfo });
    }

    if (foundExpression && !origin) {
        alert('Import contains relative or variable expressions. Please set an origin first.');
        return;
    }

    // resolve parsed items into absolute coordinates and set cells
    const setCellAt = (ax, ay) => {
        if (Number.isInteger(ax) && Number.isInteger(ay) && ax >= 0 && ax < WIDTH && ay >= 0 && ay < HEIGHT) {
            const cell = document.querySelector(`.cell[data-x="${ax}"][data-y="${ay}"]`);
            if (cell) cell.classList.add('on');
        }
    };

    const resolveInfo = (info) => {
        if (info.type === 'number') return info.value;
        const baseName = info.base;
        let baseVal;
        if (/^-?\d+$/.test(baseName)) baseVal = parseInt(baseName, 10);
        else if (baseName === 'x') baseVal = origin ? origin[0] : null;
        else if (baseName === 'y') baseVal = origin ? origin[1] : null;
        else {
            alert('Unsupported variable base "' + baseName + '" in import. Only "x" and "y" are supported for variable imports.');
            throw new Error('unsupported variable');
        }
        if (baseVal === null) throw new Error('origin required');
        if (!info.op) return baseVal + info.n;
        return info.op === '+' ? baseVal + info.n : baseVal - info.n;
    };

    try {
        for (const item of parsedPoints) {
            if (item.type === 'pixel') {
                const ax = resolveInfo(item.xInfo);
                const ay = resolveInfo(item.yInfo);
                setCellAt(ax, ay);
            } else if (item.type === 'hline') {
                const ax = resolveInfo(item.xInfo);
                const ay = resolveInfo(item.yInfo);
                const aw = resolveInfo(item.wInfo);
                for (let i = 0; i < aw; i++) setCellAt(ax + i, ay);
            } else if (item.type === 'vline') {
                const ax = resolveInfo(item.xInfo);
                const ay = resolveInfo(item.yInfo);
                const aw = resolveInfo(item.wInfo);
                for (let i = 0; i < aw; i++) setCellAt(ax, ay + i);
            }
        }
    } catch (e) {
        // resolving failed (likely missing origin); user already alerted in resolveInfo
        return;
    }
});

document.getElementById('copyBtn').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(codeBox.value);
        alert('Copied to clipboard');
    } catch (e) {
        alert('Copy failed — select and copy manually');
    }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    const blob = new Blob([codeBox.value || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'u8g2_pixels.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

document.getElementById('setOriginBtn').addEventListener('click', () => {
    awaitingOrigin = !awaitingOrigin;
    if (originDisplay) originDisplay.textContent = '(click a cell)';
});

document.getElementById('clearOriginBtn').addEventListener('click', () => {
    if (originCell) originCell.classList.remove('origin');
    origin = null;
    originCell = null;
    if (originDisplay) originDisplay.textContent = 'none';
});

function setOriginCell(c) {
    if (originCell) originCell.classList.remove('origin');
    const x = parseInt(c.dataset.x);
    const y = parseInt(c.dataset.y);
    origin = [x, y];
    originCell = c;
    originCell.classList.add('origin');
    if (originDisplay) originDisplay.textContent = `${x}, ${y}`;
}

buildGrid(defaultCellSize);

document.addEventListener('keydown', (ev) => {
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('cell')) {
        const c = document.activeElement;
        if (ev.key === ' ') {
            ev.preventDefault();
            c.classList.toggle('on');
        }
    }
});

document.getElementById('presetHeart').addEventListener('click', () => {
    const heartPattern = [
        "00000000",
        "01100110",
        "11111111",
        "11111111",
        "11111111",
        "01111110",
        "00111100",
        "00011000"
    ];
    applyPresetPattern(heartPattern);
});

document.getElementById('presetCube').addEventListener('click', () => {
    const cubePattern = [
        "00000000",
        "01111110",
        "01111110",
        "01111110",
        "01111110",
        "01111110",
        "01111110",
        "00000000"
    ];
    applyPresetPattern(cubePattern);
});

document.getElementById('presetCircle').addEventListener('click', () => {
    const cubePattern = [
        "00111100",
        "01111110",
        "11111111",
        "11111111",
        "11111111",
        "11111111",
        "01111110",
        "00111100"
    ];
    applyPresetPattern(cubePattern);
});

function applyPresetPattern(pattern) {
    if(origin) {
        const offsetX = origin[0];
        const offsetY = origin[1];
        document.querySelectorAll('.cell.on').forEach(c => c.classList.remove('on'));
        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[y].length; x++) {
                if (pattern[y][x] === '1') {
                    const cell = document.querySelector(`.cell[data-x="${x + offsetX}"][data-y="${y + offsetY}"]`);
                    if (cell) cell.classList.add('on');
                }
            }
        }
    }
    else {
        alert('Please set an origin before applying a preset pattern.');
    }
}

function detectLines(points) {
    const set = new Set(points.map(p => `${p[0]},${p[1]}`));
    const consumed = new Set();
    // sort by y then x so horizontal runs start from leftmost, vertical from topmost
    points.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const cmds = [];
    for (const [x, y] of points) {
        const key = `${x},${y}`;
        if (consumed.has(key)) continue;
        // compute horizontal length starting at (x,y)
        let hx = x + 1;
        let hlen = 1;
        while (set.has(`${hx},${y}`) && !consumed.has(`${hx},${y}`)) {
            hlen++; hx++;
        }
        // compute vertical length starting at (x,y)
        let vy = y + 1;
        let vlen = 1;
        while (set.has(`${x},${vy}`) && !consumed.has(`${x},${vy}`)) {
            vlen++; vy++;
        }

        // choose longer run if length > 1
        if (hlen > 1 || vlen > 1) {
            if (hlen >= vlen) {
                // horizontal line
                cmds.push({ type: 'hline', x: x, y: y, w: hlen });
                // mark consumed
                for (let i = 0; i < hlen; i++) consumed.add(`${x + i},${y}`);
            } else {
                // vertical line
                cmds.push({ type: 'vline', x: x, y: y, w: vlen });
                for (let i = 0; i < vlen; i++) consumed.add(`${x},${y + i}`);
            }
        } else {
            // single pixel
            cmds.push({ type: 'pixel', x: x, y: y });
            consumed.add(key);
        }
    }
    return cmds;
}

document.getElementById('gridColorInput').addEventListener('input', (ev) => {
    document.documentElement.style.setProperty('--grid-bg', ev.target.value);
});

document.getElementById('pixelColorInput').addEventListener('input', (ev) => {
    document.documentElement.style.setProperty('--pixel-on', ev.target.value);
}); 
document.getElementById('originColorInput').addEventListener('input', (ev) => {
    document.documentElement.style.setProperty('--origin-color', ev.target.value);
});

document.getElementById('resetColors').addEventListener('click', () => {
    document.documentElement.style.setProperty('--grid-bg', '#99abbe');
    document.documentElement.style.setProperty('--pixel-on', '#6ee7b7');
    document.documentElement.style.setProperty('--origin-color', '#ffd86b');
    document.getElementById('gridColorInput').value = '#99abbe';
    document.getElementById('pixelColorInput').value = '#6ee7b7';
    document.getElementById('originColorInput').value = '#ffd86b';
});