// Diagonal-First Bento Grid Generator
// Diagonals are shared edges between overlapping cells

const PALETTE = [
  '#22d3ee', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb',
  '#34d399', '#10b981', '#14b8a6', '#06b6d4', '#0891b2',
  '#0ea5e9', '#0284c7', '#0d9488', '#059669', '#2dd4bf', '#5eead4'
];

// ============================================
// DIAGONAL EDGE - A shared boundary between cells
// ============================================

class DiagonalEdge {
  constructor(x1, y1, x2, y2) {
    // Line from point 1 to point 2
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;

    // For physics: rest positions and current positions
    this.restX1 = x1;
    this.restY1 = y1;
    this.restX2 = x2;
    this.restY2 = y2;
  }

  // Which side of the diagonal is a point on?
  // Returns positive for one side, negative for other, 0 on line
  getSide(x, y) {
    return (this.x2 - this.x1) * (y - this.y1) - (this.y2 - this.y1) * (x - this.x1);
  }
}

// ============================================
// CELL - Bounded by edges, optionally clipped by diagonals
// ============================================

class Cell {
  constructor(id, left, top, right, bottom) {
    this.id = id;
    this.color = PALETTE[id % PALETTE.length];

    // Bounding box (rest positions)
    this.restLeft = left;
    this.restTop = top;
    this.restRight = right;
    this.restBottom = bottom;

    // Current positions (for physics)
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;

    // Diagonal clips: { diagonal: DiagonalEdge, keepSide: 'positive' | 'negative' }
    this.diagonalClips = [];
  }

  get width() { return this.right - this.left; }
  get height() { return this.bottom - this.top; }
  get restWidth() { return this.restRight - this.restLeft; }
  get restHeight() { return this.restBottom - this.restTop; }
  get centerX() { return (this.left + this.right) / 2; }
  get centerY() { return (this.top + this.bottom) / 2; }

  // Get polygon vertices after diagonal clipping
  getVertices(gap = 0) {
    const halfGap = gap / 2;
    const l = this.left + halfGap;
    const r = this.right - halfGap;
    const t = this.top + halfGap;
    const b = this.bottom - halfGap;

    // Start with rectangle vertices (clockwise)
    let vertices = [
      { x: l, y: t },
      { x: r, y: t },
      { x: r, y: b },
      { x: l, y: b }
    ];

    // Clip by each diagonal
    for (const clip of this.diagonalClips) {
      vertices = this.clipPolygonByDiagonal(vertices, clip.diagonal, clip.keepSide, gap);
    }

    return vertices;
  }

  // Sutherland-Hodgman style clipping
  clipPolygonByDiagonal(vertices, diagonal, keepSide, gap) {
    if (vertices.length < 3) return vertices;

    const halfGap = gap / 2;

    // Offset the diagonal line by half gap to create visual separation
    // Calculate perpendicular offset direction
    const dx = diagonal.x2 - diagonal.x1;
    const dy = diagonal.y2 - diagonal.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len * halfGap;
    const perpY = dx / len * halfGap;

    // Offset diagonal based on which side we're keeping
    const offsetMult = keepSide === 'positive' ? -1 : 1;
    const ox1 = diagonal.x1 + perpX * offsetMult;
    const oy1 = diagonal.y1 + perpY * offsetMult;
    const ox2 = diagonal.x2 + perpX * offsetMult;
    const oy2 = diagonal.y2 + perpY * offsetMult;

    const result = [];

    for (let i = 0; i < vertices.length; i++) {
      const curr = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      const currSide = (ox2 - ox1) * (curr.y - oy1) - (oy2 - oy1) * (curr.x - ox1);
      const nextSide = (ox2 - ox1) * (next.y - oy1) - (oy2 - oy1) * (next.x - ox1);

      const currInside = keepSide === 'positive' ? currSide >= 0 : currSide <= 0;
      const nextInside = keepSide === 'positive' ? nextSide >= 0 : nextSide <= 0;

      if (currInside) {
        result.push(curr);
      }

      // If edge crosses the diagonal, add intersection point
      if (currInside !== nextInside) {
        const intersection = this.lineIntersection(
          curr.x, curr.y, next.x, next.y,
          ox1, oy1, ox2, oy2
        );
        if (intersection) {
          result.push(intersection);
        }
      }
    }

    return result;
  }

  lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  containsPoint(px, py) {
    // Simple bounding box check
    return px >= this.left && px <= this.right &&
           py >= this.top && py <= this.bottom;
  }
}

// ============================================
// GRID GENERATOR WITH DIAGONAL SUPPORT
// ============================================

class BentoGenerator {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];
    this.diagonals = [];
    this.cellIdCounter = 0;
  }

  generate(depth = 5, minSize = 60, diagonalChance = 0) {
    this.cells = [];
    this.diagonals = [];
    this.cellIdCounter = 0;

    this.subdivide(0, 0, this.width, this.height, depth, minSize, diagonalChance);
  }

  subdivide(left, top, right, bottom, depth, minSize, diagonalChance) {
    const width = right - left;
    const height = bottom - top;

    // Base case: create a cell
    if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
      const cell = new Cell(this.cellIdCounter++, left, top, right, bottom);
      this.cells.push(cell);
      return [cell];
    }

    // Decide split direction based on aspect ratio
    const aspectRatio = width / height;
    let splitHorizontal;

    if (width < minSize * 1.5) {
      splitHorizontal = true;
    } else if (height < minSize * 1.5) {
      splitHorizontal = false;
    } else {
      const horizontalBias = aspectRatio < 1 ? 0.7 : 0.3;
      splitHorizontal = Math.random() < horizontalBias;
    }

    const splitRatio = 0.3 + Math.random() * 0.4;

    // Decide if this split should be diagonal
    const useDiagonal = Math.random() < diagonalChance && depth > 1;

    if (useDiagonal) {
      return this.diagonalSplit(left, top, right, bottom, depth, minSize, diagonalChance, splitHorizontal, splitRatio);
    } else {
      return this.straightSplit(left, top, right, bottom, depth, minSize, diagonalChance, splitHorizontal, splitRatio);
    }
  }

  straightSplit(left, top, right, bottom, depth, minSize, diagonalChance, splitHorizontal, splitRatio) {
    if (splitHorizontal) {
      const splitY = top + (bottom - top) * splitRatio;
      const topCells = this.subdivide(left, top, right, splitY, depth - 1, minSize, diagonalChance);
      const bottomCells = this.subdivide(left, splitY, right, bottom, depth - 1, minSize, diagonalChance);
      return [...topCells, ...bottomCells];
    } else {
      const splitX = left + (right - left) * splitRatio;
      const leftCells = this.subdivide(left, top, splitX, bottom, depth - 1, minSize, diagonalChance);
      const rightCells = this.subdivide(splitX, top, right, bottom, depth - 1, minSize, diagonalChance);
      return [...leftCells, ...rightCells];
    }
  }

  diagonalSplit(left, top, right, bottom, depth, minSize, diagonalChance, splitHorizontal, splitRatio) {
    const width = right - left;
    const height = bottom - top;

    // For diagonal splits, we create two cells that OVERLAP
    // The diagonal line cuts through the overlap

    if (splitHorizontal) {
      // Splitting horizontally with diagonal
      // Top cell and bottom cell will overlap, diagonal separates them
      const splitY = top + (bottom - top) * splitRatio;
      const overlapSize = Math.min(width, height) * 0.5; // Overlap region

      // Diagonal direction: randomly choose
      const diagonalDown = Math.random() < 0.5;

      // Create diagonal edge
      let diagonal;
      if (diagonalDown) {
        // Diagonal from top-left to bottom-right of overlap region
        diagonal = new DiagonalEdge(left, splitY - overlapSize/2, right, splitY + overlapSize/2);
      } else {
        // Diagonal from top-right to bottom-left
        diagonal = new DiagonalEdge(right, splitY - overlapSize/2, left, splitY + overlapSize/2);
      }
      this.diagonals.push(diagonal);

      // Top region: extends down into overlap, clipped by diagonal
      const topCell = new Cell(this.cellIdCounter++, left, top, right, splitY + overlapSize/2);
      topCell.diagonalClips.push({ diagonal, keepSide: 'positive' });

      // Bottom region: extends up into overlap, clipped by diagonal
      const bottomCell = new Cell(this.cellIdCounter++, left, splitY - overlapSize/2, right, bottom);
      bottomCell.diagonalClips.push({ diagonal, keepSide: 'negative' });

      this.cells.push(topCell, bottomCell);
      return [topCell, bottomCell];

    } else {
      // Splitting vertically with diagonal
      const splitX = left + (right - left) * splitRatio;
      const overlapSize = Math.min(width, height) * 0.5;

      const diagonalDown = Math.random() < 0.5;

      let diagonal;
      if (diagonalDown) {
        // Diagonal from top-left to bottom-right
        diagonal = new DiagonalEdge(splitX - overlapSize/2, top, splitX + overlapSize/2, bottom);
      } else {
        // Diagonal from bottom-left to top-right
        diagonal = new DiagonalEdge(splitX - overlapSize/2, bottom, splitX + overlapSize/2, top);
      }
      this.diagonals.push(diagonal);

      // Left region: extends right into overlap
      const leftCell = new Cell(this.cellIdCounter++, left, top, splitX + overlapSize/2, bottom);
      leftCell.diagonalClips.push({ diagonal, keepSide: 'positive' });

      // Right region: extends left into overlap
      const rightCell = new Cell(this.cellIdCounter++, splitX - overlapSize/2, top, right, bottom);
      rightCell.diagonalClips.push({ diagonal, keepSide: 'negative' });

      this.cells.push(leftCell, rightCell);
      return [leftCell, rightCell];
    }
  }
}

// ============================================
// PHYSICS ENGINE
// ============================================

class PhysicsEngine {
  constructor(generator) {
    this.generator = generator;
    this.hoveredCell = null;
    this.hoverScale = 1;

    // Physics parameters
    this.springStrength = 0.15;
    this.damping = 0.85;
    this.incompressibility = 0.7;
    this.minSizeRatio = 0.5;
    this.bleedZone = 50;

    // Animation parameters
    this.scaleSpeed = 0.25;
    this.rippleSpeed = 0.10;
    this.overshoot = 0.15;
    this.fillRatio = 0;

    // Velocity for each cell
    this.velocities = new Map();
    for (const cell of generator.cells) {
      this.velocities.set(cell, { left: 0, top: 0, right: 0, bottom: 0 });
    }
  }

  applyHoverForce(cell, scale) {
    if (!cell) return;
    this.hoveredCell = cell;
    this.hoverScale = scale;

    // Calculate target size
    const restW = cell.restWidth;
    const restH = cell.restHeight;
    const cx = cell.restLeft + restW / 2;
    const cy = cell.restTop + restH / 2;

    // Apply fill ratio (counter aspect ratio)
    const aspect = restW / restH;
    let scaleX = scale;
    let scaleY = scale;

    if (this.fillRatio > 0) {
      if (aspect > 1) {
        scaleY = 1 + (scale - 1) * (1 + (aspect - 1) * this.fillRatio);
      } else if (aspect < 1) {
        scaleX = 1 + (scale - 1) * (1 + (1/aspect - 1) * this.fillRatio);
      }
    }

    const targetW = restW * scaleX;
    const targetH = restH * scaleY;

    // Move hovered cell toward target
    cell.left += ((cx - targetW/2) - cell.left) * this.scaleSpeed;
    cell.right += ((cx + targetW/2) - cell.right) * this.scaleSpeed;
    cell.top += ((cy - targetH/2) - cell.top) * this.scaleSpeed;
    cell.bottom += ((cy + targetH/2) - cell.bottom) * this.scaleSpeed;
  }

  update() {
    const cells = this.generator.cells;

    // Apply spring forces to return to rest
    for (const cell of cells) {
      if (cell === this.hoveredCell) continue;

      const vel = this.velocities.get(cell);

      // Spring back to rest position
      vel.left += (cell.restLeft - cell.left) * this.springStrength * this.rippleSpeed;
      vel.top += (cell.restTop - cell.top) * this.springStrength * this.rippleSpeed;
      vel.right += (cell.restRight - cell.right) * this.springStrength * this.rippleSpeed;
      vel.bottom += (cell.restBottom - cell.bottom) * this.springStrength * this.rippleSpeed;

      // Damping
      const dampFactor = this.damping - this.overshoot * 0.3;
      vel.left *= dampFactor;
      vel.top *= dampFactor;
      vel.right *= dampFactor;
      vel.bottom *= dampFactor;

      // Apply velocity
      cell.left += vel.left;
      cell.top += vel.top;
      cell.right += vel.right;
      cell.bottom += vel.bottom;
    }

    // Simple incompressibility: push neighbors away from hovered cell
    if (this.hoveredCell) {
      const hovered = this.hoveredCell;
      const hoverCx = hovered.restLeft + hovered.restWidth / 2;
      const hoverCy = hovered.restTop + hovered.restHeight / 2;

      for (const cell of cells) {
        if (cell === hovered) continue;

        const cellCx = cell.restLeft + cell.restWidth / 2;
        const cellCy = cell.restTop + cell.restHeight / 2;

        // Direction from hover to this cell
        const dx = cellCx - hoverCx;
        const dy = cellCy - hoverCy;

        // Check for overlap and push away
        const overlapX = Math.min(hovered.right, cell.right) - Math.max(hovered.left, cell.left);
        const overlapY = Math.min(hovered.bottom, cell.bottom) - Math.max(hovered.top, cell.top);

        if (overlapX > 0 && overlapY > 0) {
          const pushStrength = this.incompressibility * 0.5;

          if (dx > 0) {
            cell.left += overlapX * pushStrength;
            cell.right += overlapX * pushStrength;
          } else if (dx < 0) {
            cell.left -= overlapX * pushStrength;
            cell.right -= overlapX * pushStrength;
          }

          if (dy > 0) {
            cell.top += overlapY * pushStrength;
            cell.bottom += overlapY * pushStrength;
          } else if (dy < 0) {
            cell.top -= overlapY * pushStrength;
            cell.bottom -= overlapY * pushStrength;
          }
        }
      }
    }
  }

  clearHover() {
    this.hoveredCell = null;
    this.hoverScale = 1;
  }

  reset() {
    this.clearHover();
    for (const cell of this.generator.cells) {
      cell.left = cell.restLeft;
      cell.top = cell.restTop;
      cell.right = cell.restRight;
      cell.bottom = cell.restBottom;
      this.velocities.set(cell, { left: 0, top: 0, right: 0, bottom: 0 });
    }
  }
}

// ============================================
// MAIN APPLICATION
// ============================================

class BentoGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // Settings
    this.gap = 8;
    this.hoverScale = 1.4;
    this.subdivisionDepth = 5;
    this.minCellSize = 80;
    this.diagonalChance = 0; // 0 to 1

    // State
    this.generator = null;
    this.physics = null;
    this.hoveredCell = null;
    this.canvasOffsetX = 0;
    this.canvasOffsetY = 0;

    this.updateDimensions();
    this.setupEventListeners();
    this.regenerate();
    this.startAnimation();
  }

  updateDimensions() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    const padding = 200;
    this.canvas.width = this.width + padding * 2;
    this.canvas.height = this.height + padding * 2;

    this.canvasOffsetX = padding;
    this.canvasOffsetY = padding;

    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `-${padding}px`;
    this.canvas.style.top = `-${padding}px`;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.updateDimensions();
      this.regenerate();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - this.canvasOffsetX;
      const my = e.clientY - rect.top - this.canvasOffsetY;

      this.hoveredCell = null;
      for (const cell of this.generator.cells) {
        if (cell.containsPoint(mx, my)) {
          this.hoveredCell = cell;
          break;
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredCell = null;
    });
  }

  regenerate() {
    this.generator = new BentoGenerator(this.width, this.height);
    this.generator.generate(this.subdivisionDepth, this.minCellSize, this.diagonalChance);
    this.physics = new PhysicsEngine(this.generator);
    this.physics.reset();
  }

  startAnimation() {
    const tick = () => {
      if (this.hoveredCell) {
        this.physics.applyHoverForce(this.hoveredCell, this.hoverScale);
      } else {
        this.physics.clearHover();
      }

      this.physics.update();
      this.render();

      requestAnimationFrame(tick);
    };

    tick();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.canvasOffsetX, this.canvasOffsetY);

    const radius = 6;

    for (const cell of this.generator.cells) {
      const vertices = cell.getVertices(this.gap);
      if (vertices.length < 3) continue;

      // Bounding box for outside check
      const minX = Math.min(...vertices.map(v => v.x));
      const minY = Math.min(...vertices.map(v => v.y));
      const maxX = Math.max(...vertices.map(v => v.x));
      const maxY = Math.max(...vertices.map(v => v.y));

      if (maxX - minX <= 0 || maxY - minY <= 0) continue;

      const isHovered = cell === this.hoveredCell;
      const isOutside = minX < 0 || minY < 0 || maxX > this.width || maxY > this.height;

      ctx.fillStyle = isHovered ? '#ef4444' : cell.color;
      ctx.globalAlpha = isOutside ? 0.5 : 0.9;

      // Draw polygon with rounded corners
      this.drawRoundedPolygon(ctx, vertices, radius);

      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawRoundedPolygon(ctx, vertices, radius) {
    ctx.beginPath();
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
      const curr = vertices[i];
      const next = vertices[(i + 1) % n];

      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      const r = Math.min(radius, len / 3);

      if (i === 0) {
        ctx.moveTo(curr.x + (dx / len) * r, curr.y + (dy / len) * r);
      }

      const endX = next.x - (dx / len) * r;
      const endY = next.y - (dy / len) * r;
      ctx.lineTo(endX, endY);

      const afterNext = vertices[(i + 2) % n];
      const dx2 = afterNext.x - next.x;
      const dy2 = afterNext.y - next.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const r2 = Math.min(radius, len2 / 3);

      const cornerEndX = next.x + (dx2 / len2) * r2;
      const cornerEndY = next.y + (dy2 / len2) * r2;

      ctx.quadraticCurveTo(next.x, next.y, cornerEndX, cornerEndY);
    }
    ctx.closePath();
  }

  // Public API
  getShapeCount() {
    return this.generator ? this.generator.cells.length : 0;
  }

  getDiagonalCount() {
    return this.generator ? this.generator.diagonals.length : 0;
  }

  setGap(gap) {
    this.gap = gap;
  }

  setHoverScale(scale) {
    this.hoverScale = scale;
  }

  setSubdivisionDepth(depth) {
    this.subdivisionDepth = depth;
    this.regenerate();
  }

  setDiagonalChance(chance) {
    this.diagonalChance = chance;
    this.regenerate();
  }

  setIncompressibility(value) {
    if (this.physics) this.physics.incompressibility = value;
  }

  setMinSizeRatio(value) {
    if (this.physics) this.physics.minSizeRatio = value;
  }

  setBleedZone(value) {
    if (this.physics) this.physics.bleedZone = value;
  }

  setScaleSpeed(value) {
    if (this.physics) this.physics.scaleSpeed = value;
  }

  setRippleSpeed(value) {
    if (this.physics) this.physics.rippleSpeed = value;
  }

  setOvershoot(value) {
    if (this.physics) this.physics.overshoot = value;
  }

  setFillRatio(value) {
    if (this.physics) this.physics.fillRatio = value;
  }
}

// ============================================
// INITIALIZATION
// ============================================

function updateMetrics() {
  if (!bentoGrid) return;

  const metricsEl = document.getElementById('metrics');
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div><span style="opacity:0.5">Cells:</span> ${bentoGrid.getShapeCount()}</div>
      <div><span style="opacity:0.5">Diagonals:</span> ${bentoGrid.getDiagonalCount()}</div>
    `;
  }
}

let bentoGrid;

function init() {
  bentoGrid = new BentoGrid('container');

  const controls = {
    subdivisions: {
      el: document.getElementById('subdivisions'),
      display: document.getElementById('subdivisionsValue'),
      handler: (val) => {
        bentoGrid.setSubdivisionDepth(parseInt(val));
        updateMetrics();
      },
      format: (val) => val
    },
    gap: {
      el: document.getElementById('gap'),
      display: document.getElementById('gapValue'),
      handler: (val) => bentoGrid.setGap(parseFloat(val)),
      format: (val) => val
    },
    hoverScale: {
      el: document.getElementById('hoverScale'),
      display: document.getElementById('hoverScaleValue'),
      handler: (val) => bentoGrid.setHoverScale(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(1) + 'x'
    },
    incompress: {
      el: document.getElementById('incompress'),
      display: document.getElementById('incompressValue'),
      handler: (val) => bentoGrid.setIncompressibility(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    minSize: {
      el: document.getElementById('minSize'),
      display: document.getElementById('minSizeValue'),
      handler: (val) => bentoGrid.setMinSizeRatio(parseFloat(val)),
      format: (val) => Math.round(parseFloat(val) * 100) + '%'
    },
    bleed: {
      el: document.getElementById('bleed'),
      display: document.getElementById('bleedValue'),
      handler: (val) => bentoGrid.setBleedZone(parseFloat(val)),
      format: (val) => val + 'px'
    },
    scaleSpeed: {
      el: document.getElementById('scaleSpeed'),
      display: document.getElementById('scaleSpeedValue'),
      handler: (val) => bentoGrid.setScaleSpeed(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    ripple: {
      el: document.getElementById('ripple'),
      display: document.getElementById('rippleValue'),
      handler: (val) => bentoGrid.setRippleSpeed(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    overshoot: {
      el: document.getElementById('overshoot'),
      display: document.getElementById('overshootValue'),
      handler: (val) => bentoGrid.setOvershoot(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(2)
    },
    fillRatio: {
      el: document.getElementById('fillRatio'),
      display: document.getElementById('fillRatioValue'),
      handler: (val) => bentoGrid.setFillRatio(parseFloat(val)),
      format: (val) => parseFloat(val).toFixed(1)
    },
    diagonals: {
      el: document.getElementById('diagonals'),
      display: document.getElementById('diagonalsValue'),
      handler: (val) => {
        // Convert 0-20 slider to 0-1 chance
        bentoGrid.setDiagonalChance(parseInt(val) / 20);
        updateMetrics();
      },
      format: (val) => val
    }
  };

  for (const [, ctrl] of Object.entries(controls)) {
    if (ctrl.el) {
      ctrl.el.addEventListener('input', (e) => {
        ctrl.handler(e.target.value);
        if (ctrl.display) ctrl.display.textContent = ctrl.format(e.target.value);
      });
    }
  }

  document.getElementById('regen').addEventListener('click', () => {
    bentoGrid.regenerate();
    updateMetrics();
  });

  updateMetrics();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
