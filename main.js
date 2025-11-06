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
    
    // if relative output is requested, require an origin and format as base +/- offset
    function formatCoord(base, delta) {
        if (delta === 0) return `${base}`;
        return delta > 0 ? `${base} + ${delta}` : `${base} - ${Math.abs(delta)}`;
    }

    let lines = [];
    const mode = getOutputMode();
    if (mode === 'normal') {
        lines = points.map(p => `${prefix}${p[0]}, ${p[1]}${suffix}`);
    } else if (mode === 'relative' || mode === 'variable') {
        if (!origin) {
            alert(`Please set an origin for ${mode} mode.`);
            return;
        }
        const baseX = mode === 'variable' ? 'x' : origin[0];
        const baseY = mode === 'variable' ? 'y' : origin[1];
        lines = points.map(p => {
            const dx = p[0] - origin[0];
            const dy = p[1] - origin[1];
            const xExpr = formatCoord(baseX, dx);
            const yExpr = formatCoord(baseY, dy);
            return `${prefix}${xExpr}, ${yExpr}${suffix}`;
        });
    } else {
        // fallback to normal
        lines = points.map(p => `${prefix}${p[0]}, ${p[1]}${suffix}`);
    }
    codeBox.value = lines.join('\n');
    
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
        parsedPoints.push({ xInfo, yInfo });
    }

    if (foundExpression && !origin) {
        alert('Import contains relative or variable expressions. Please set an origin first.');
        return;
    }

    for (const p of parsedPoints) {
        let ax, ay;
        const resolve = (info, axis) => {
            if (info.type === 'number') return info.value;
            
            const baseName = info.base;
            let baseVal;
            if (/^-?\d+$/.test(baseName)) baseVal = parseInt(baseName, 10);
            else if (baseName === 'x') baseVal = origin[0];
            else if (baseName === 'y') baseVal = origin[1];
            else {
                alert('Unsupported variable base "' + baseName + '" in import. Only "x" and "y" are supported for variable imports.');
                throw new Error('unsupported variable');
            }
            if (!info.op) return baseVal + info.n; 
            return info.op === '+' ? baseVal + info.n : baseVal - info.n;
        };

        try {
            ax = resolve(p.xInfo, 'x');
            ay = resolve(p.yInfo, 'y');
        } catch (e) {
            return; 
        }

        if (Number.isInteger(ax) && Number.isInteger(ay) && ax >= 0 && ax < WIDTH && ay >= 0 && ay < HEIGHT) {
            const cell = document.querySelector(`.cell[data-x="${ax}"][data-y="${ay}"]`);
            if (cell) cell.classList.add('on');
        }
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