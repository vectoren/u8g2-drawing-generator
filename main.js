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
const setOriginBtn = document.getElementById('setOriginBtn');
const clearOriginBtn = document.getElementById('clearOriginBtn');
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
                // if we're awaiting an origin selection, use this click to set it
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
            alert('Please set an origin first (click "Set origin" and then a cell).');
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
    if(codeBox.value != null || codeBox.value != "")
    {
        let lines_import = [] = codeBox.value.split("\n");
        for(let i = 0; i < lines_import.length; i++)
        {
            lines_import[i] = lines_import[i].replace(prefix, "");
            lines_import[i] = lines_import[i].replace(suffix, "");
            lines_import[i] = lines_import[i].split(", ");
        }
        document.querySelectorAll('.cell').forEach(c => 
        {
            for(let x = 0; x < lines_import.length; x++)
            {
                if(c.dataset.x == lines_import[x][0] && c.dataset.y == lines_import[x][1]){
                    if(!c.classList.contains('on')){
                        c.classList.add('on');
                    }
                }
            }
        }); 
        
    };

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

    // --- origin helpers and UI wiring ---
    function setOriginCell(c) {
        if (originCell) originCell.classList.remove('origin');
        const x = parseInt(c.dataset.x);
        const y = parseInt(c.dataset.y);
        origin = [x, y];
        originCell = c;
        originCell.classList.add('origin');
        if (originDisplay) originDisplay.textContent = `${x}, ${y}`;
    }

    function clearOrigin() {
        if (originCell) originCell.classList.remove('origin');
        origin = null;
        originCell = null;
        if (originDisplay) originDisplay.textContent = 'none';
    }

    if (setOriginBtn) {
        setOriginBtn.addEventListener('click', () => {
            awaitingOrigin = true;
            if (originDisplay) originDisplay.textContent = '(click a cell)';
        });
    }

    if (clearOriginBtn) {
        clearOriginBtn.addEventListener('click', () => clearOrigin());
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