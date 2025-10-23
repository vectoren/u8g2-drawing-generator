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

function buildGrid(cellSize) {
    gridContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = `repeat(${WIDTH}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${HEIGHT}, ${cellSize}px)`;
    grid.style.gap = 'var(--grid-gap)';
    // grid.style.width = `${WIDTH * cellSize}px`;
    grid.style.width = `540px`;
    // grid.style.height = `${HEIGHT * cellSize}px`;
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
                isMouseDown = true;
                if (ev.button === 2) {
                    draggingMode = 'erase';
                    setCell(c, false);
                } else {
                    draggingMode = 'paint';
                    setCell(c, !c.classList.contains('on'));
                }
                modeLabel.textContent = draggingMode;
            });
            c.addEventListener('mouseenter', (ev) => {
                if (isMouseDown) {
                    if (draggingMode === 'paint') setCell(c, true);
                    else setCell(c, false);
                }
            });
            c.addEventListener('mouseup', () => {
                isMouseDown = false;
                modeLabel.textContent = 'paint';
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
    modeLabel.textContent = 'paint';
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.querySelectorAll('.cell.on').forEach(c => c.classList.remove('on'));
    codeBox.textContent = '';
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
    else if (order === 'scan') points.sort((a, b) => (a[1] * WIDTH + a[0]) - (b[1] * WIDTH + b[0]));
    const lines = points.map(p => `${prefix}${p[0]}, ${p[1]}${suffix}`);
    codeBox.textContent = lines.join('\n');
});

document.getElementById('copyBtn').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(codeBox.textContent);
        alert('Copied to clipboard');
    } catch (e) {
        alert('Copy failed — select and copy manually');
    }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    const blob = new Blob([codeBox.textContent || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'u8g2_pixels.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

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