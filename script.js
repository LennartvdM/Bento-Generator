// Edge-Based Bento Grid
// Cells are defined by edges, not dimensions
// When edges move, cells automatically reshape

const PALETTE = [
  '#22d3ee', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb',
  '#34d399', '#10b981', '#14b8a6', '#06b6d4', '#0891b2',
  '#0ea5e9', '#0284c7', '#0d9488', '#059669', '#2dd4bf', '#5eead4'
];

// ============================================
// EDGE-BASED DATA MODEL
// ============================================

class Edge {
  constructor(id, position, isHorizontal, isBoundary = false) {
    this.id = id;
    this.isHorizontal = isHorizontal;
    this.isBoundary = isBoundary; // Boundaries can flex but resist strongly

    // Physics state
    this.rest = position;
    this.pos = position;
    this.velocity = 0;
    this.force = 0;

    // Connections to other edges
    this.connectedEdges = new Set();
  }
}

class Cell {
  constructor(id, topEdge, bottomEdge, leftEdge, rightEdge) {
    this.id = id;
    this.top = topEdge;
    this.bottom = bottomEdge;
    this.left = leftEdge;
    this.right = rightEdge;
    this.color = PALETTE[id % PALETTE.length];
  }

  get x() { return this.left.pos; }
  get y() { return this.top.pos; }
  get width() { return this.right.pos - this.left.pos; }
  get height() { return this.bottom.pos - this.top.pos; }

  get restX() { return this.left.rest; }
  get restY() { return this.top.rest; }
  get restWidth() { return this.right.rest - this.left.rest; }
  get restHeight() { return this.bottom.rest - this.top.rest; }

  containsPoint(px, py) {
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }
}

// ============================================
// TREEMAP SUBDIVISION
// ============================================

class EdgeGrid {
  constructor(width, height, gap) {
    this.width = width;
    this.height = height;
    this.gap = gap;

    this.edges = new Map();
    this.cells = [];
    this.edgeIdCounter = 0;

    // Create boundary edges (soft - can flex outward)
    this.topBoundary = this.createEdge(0, true, true);
    this.bottomBoundary = this.createEdge(height, true, true);
    this.leftBoundary = this.createEdge(0, false, true);
    this.rightBoundary = this.createEdge(width, false, true);
  }

  createEdge(position, isHorizontal, isBoundary = false) {
    const id = `e${this.edgeIdCounter++}`;
    const edge = new Edge(id, position, isHorizontal, isBoundary);
    this.edges.set(id, edge);
    return edge;
  }

  subdivide(topEdge, bottomEdge, leftEdge, rightEdge, depth, minSize) {
    const width = rightEdge.rest - leftEdge.rest;
    const height = bottomEdge.rest - topEdge.rest;

    if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
      const cell = new Cell(
        this.cells.length,
        topEdge, bottomEdge, leftEdge, rightEdge
      );
      this.cells.push(cell);
      return;
    }

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

    if (splitHorizontal) {
      const splitY = topEdge.rest + (bottomEdge.rest - topEdge.rest) * splitRatio;
      const splitEdge = this.createEdge(splitY, true, false);

      splitEdge.connectedEdges.add(leftEdge.id);
      splitEdge.connectedEdges.add(rightEdge.id);
      leftEdge.connectedEdges.add(splitEdge.id);
      rightEdge.connectedEdges.add(splitEdge.id);

      this.subdivide(topEdge, splitEdge, leftEdge, rightEdge, depth - 1, minSize);
      this.subdivide(splitEdge, bottomEdge, leftEdge, rightEdge, depth - 1, minSize);
    } else {
      const splitX = leftEdge.rest + (rightEdge.rest - leftEdge.rest) * splitRatio;
      const splitEdge = this.createEdge(splitX, false, false);

      splitEdge.connectedEdges.add(topEdge.id);
      splitEdge.connectedEdges.add(bottomEdge.id);
      topEdge.connectedEdges.add(splitEdge.id);
      bottomEdge.connectedEdges.add(splitEdge.id);

      this.subdivide(topEdge, bottomEdge, leftEdge, splitEdge, depth - 1, minSize);
      this.subdivide(topEdge, bottomEdge, splitEdge, rightEdge, depth - 1, minSize);
    }
  }

  generate(subdivisionDepth = 5, minCellSize = 60) {
    this.cells = [];

    const boundaryIds = new Set([
      this.topBoundary.id, this.bottomBoundary.id,
      this.leftBoundary.id, this.rightBoundary.id
    ]);

    for (const [id] of this.edges) {
      if (!boundaryIds.has(id)) {
        this.edges.delete(id);
      }
    }

    this.topBoundary.connectedEdges.clear();
    this.bottomBoundary.connectedEdges.clear();
    this.leftBoundary.connectedEdges.clear();
    this.rightBoundary.connectedEdges.clear();

    this.subdivide(
      this.topBoundary, this.bottomBoundary,
      this.leftBoundary, this.rightBoundary,
      subdivisionDepth, minCellSize
    );
  }
}

// ============================================
// SPRING PHYSICS ENGINE WITH INCOMPRESSIBILITY
// ============================================

class PhysicsEngine {
  constructor(edgeGrid) {
    this.grid = edgeGrid;
    this.hoveredCell = null;
    this.hoverScale = 1;

    // Track which edges belong to hovered cell (they have priority)
    this.hoveredEdges = new Set();

    // Physics parameters (exposed to UI)
    this.springStrength = 0.12;
    this.damping = 0.80;
    this.incompressibility = 0.7;
    this.minSizeRatio = 0.5;
    this.bleedZone = 50;
    this.boundaryResistance = 0.8;

    this.rippleIterations = 3;
  }

  applyHoverForce(cell, scale) {
    if (!cell) return;
    this.hoveredCell = cell;
    this.hoverScale = scale;

    // Mark hovered cell's edges
    this.hoveredEdges.clear();
    this.hoveredEdges.add(cell.top);
    this.hoveredEdges.add(cell.bottom);
    this.hoveredEdges.add(cell.left);
    this.hoveredEdges.add(cell.right);

    // Calculate target positions for hovered cell's edges
    const cx = cell.restX + cell.restWidth / 2;
    const cy = cell.restY + cell.restHeight / 2;
    const targetHalfW = (cell.restWidth * scale) / 2;
    const targetHalfH = (cell.restHeight * scale) / 2;

    // Move hovered edges DIRECTLY toward targets (authoritative, no fighting)
    const lerpSpeed = 0.25;

    if (!cell.top.isBoundary) {
      const targetY = cy - targetHalfH;
      cell.top.pos += (targetY - cell.top.pos) * lerpSpeed;
      cell.top.velocity = 0; // No momentum, just direct movement
    }
    if (!cell.bottom.isBoundary) {
      const targetY = cy + targetHalfH;
      cell.bottom.pos += (targetY - cell.bottom.pos) * lerpSpeed;
      cell.bottom.velocity = 0;
    }
    if (!cell.left.isBoundary) {
      const targetX = cx - targetHalfW;
      cell.left.pos += (targetX - cell.left.pos) * lerpSpeed;
      cell.left.velocity = 0;
    }
    if (!cell.right.isBoundary) {
      const targetX = cx + targetHalfW;
      cell.right.pos += (targetX - cell.right.pos) * lerpSpeed;
      cell.right.velocity = 0;
    }
  }

  applyIncompressibility() {
    if (!this.hoveredCell) return;

    // Get hover cell center for directional reference
    const hoverCx = this.hoveredCell.restX + this.hoveredCell.restWidth / 2;
    const hoverCy = this.hoveredCell.restY + this.hoveredCell.restHeight / 2;

    for (const cell of this.grid.cells) {
      if (cell === this.hoveredCell) continue;

      const widthRatio = cell.width / cell.restWidth;
      const heightRatio = cell.height / cell.restHeight;

      // Cell center for direction calculation
      const cellCx = cell.restX + cell.restWidth / 2;
      const cellCy = cell.restY + cell.restHeight / 2;

      // Direction FROM hover TO this cell (this is the allowed push direction)
      const dirX = cellCx - hoverCx;
      const dirY = cellCy - hoverCy;

      // Hard limit: push back strongly when below minimum
      if (widthRatio < this.minSizeRatio) {
        const deficit = cell.restWidth * this.minSizeRatio - cell.width;
        const force = deficit * this.incompressibility * 1.5;

        // Only push edges in the direction AWAY from hover
        if (!this.hoveredEdges.has(cell.left)) {
          // Left edge can only move left (negative) if cell is left of hover
          if (dirX < 0) cell.left.force -= force;
        }
        if (!this.hoveredEdges.has(cell.right)) {
          // Right edge can only move right (positive) if cell is right of hover
          if (dirX > 0) cell.right.force += force;
        }
        // If neither direction works, allow both (edge case)
        if (dirX === 0) {
          if (!this.hoveredEdges.has(cell.left)) cell.left.force -= force * 0.5;
          if (!this.hoveredEdges.has(cell.right)) cell.right.force += force * 0.5;
        }
      }

      if (heightRatio < this.minSizeRatio) {
        const deficit = cell.restHeight * this.minSizeRatio - cell.height;
        const force = deficit * this.incompressibility * 1.5;

        if (!this.hoveredEdges.has(cell.top)) {
          if (dirY < 0) cell.top.force -= force;
        }
        if (!this.hoveredEdges.has(cell.bottom)) {
          if (dirY > 0) cell.bottom.force += force;
        }
        if (dirY === 0) {
          if (!this.hoveredEdges.has(cell.top)) cell.top.force -= force * 0.5;
          if (!this.hoveredEdges.has(cell.bottom)) cell.bottom.force += force * 0.5;
        }
      }

      // Soft resistance (same directional logic)
      if (widthRatio < 1.0) {
        const compression = 1.0 - widthRatio;
        const softForce = compression * cell.restWidth * this.incompressibility * 0.4;

        if (!this.hoveredEdges.has(cell.left) && dirX <= 0) {
          cell.left.force -= softForce;
        }
        if (!this.hoveredEdges.has(cell.right) && dirX >= 0) {
          cell.right.force += softForce;
        }
      }

      if (heightRatio < 1.0) {
        const compression = 1.0 - heightRatio;
        const softForce = compression * cell.restHeight * this.incompressibility * 0.4;

        if (!this.hoveredEdges.has(cell.top) && dirY <= 0) {
          cell.top.force -= softForce;
        }
        if (!this.hoveredEdges.has(cell.bottom) && dirY >= 0) {
          cell.bottom.force += softForce;
        }
      }
    }
  }

  integrateForces() {
    for (const [, edge] of this.grid.edges) {
      // Skip hovered cell's edges - they move directly, not through forces
      if (this.hoveredEdges.has(edge)) {
        edge.force = 0;
        continue;
      }

      // Boundaries use stronger spring to resist movement
      const springMult = edge.isBoundary ? this.boundaryResistance * 3 : 1;
      const springForce = (edge.rest - edge.pos) * this.springStrength * springMult;

      const totalForce = edge.force + springForce;

      edge.velocity += totalForce * 0.1;
      edge.velocity *= this.damping;
      edge.pos += edge.velocity;

      // Clamp boundaries to bleed zone
      if (edge.isBoundary) {
        if (edge === this.grid.topBoundary) {
          edge.pos = Math.max(edge.rest - this.bleedZone, Math.min(edge.rest, edge.pos));
        } else if (edge === this.grid.bottomBoundary) {
          edge.pos = Math.min(edge.rest + this.bleedZone, Math.max(edge.rest, edge.pos));
        } else if (edge === this.grid.leftBoundary) {
          edge.pos = Math.max(edge.rest - this.bleedZone, Math.min(edge.rest, edge.pos));
        } else if (edge === this.grid.rightBoundary) {
          edge.pos = Math.min(edge.rest + this.bleedZone, Math.max(edge.rest, edge.pos));
        }

        if (Math.abs(edge.pos - edge.rest) >= this.bleedZone * 0.95) {
          edge.velocity *= 0.3;
        }
      } else {
        const maxDisp = 200;
        const disp = edge.pos - edge.rest;
        if (Math.abs(disp) > maxDisp) {
          edge.pos = edge.rest + Math.sign(disp) * maxDisp;
          edge.velocity *= 0.3;
        }
      }

      edge.force = 0;
    }
  }

  enforceConstraints() {
    const minCellSize = 20;

    for (const cell of this.grid.cells) {
      // Don't constrain hovered cell
      if (cell === this.hoveredCell) continue;

      if (cell.width < minCellSize) {
        const mid = (cell.left.pos + cell.right.pos) / 2;
        if (!cell.left.isBoundary && !this.hoveredEdges.has(cell.left)) {
          cell.left.pos = mid - minCellSize / 2;
        }
        if (!cell.right.isBoundary && !this.hoveredEdges.has(cell.right)) {
          cell.right.pos = mid + minCellSize / 2;
        }
      }

      if (cell.height < minCellSize) {
        const mid = (cell.top.pos + cell.bottom.pos) / 2;
        if (!cell.top.isBoundary && !this.hoveredEdges.has(cell.top)) {
          cell.top.pos = mid - minCellSize / 2;
        }
        if (!cell.bottom.isBoundary && !this.hoveredEdges.has(cell.bottom)) {
          cell.bottom.pos = mid + minCellSize / 2;
        }
      }
    }
  }

  update() {
    for (let i = 0; i < this.rippleIterations; i++) {
      this.applyIncompressibility();
      this.integrateForces();
    }
    this.enforceConstraints();
  }

  clearHover() {
    this.hoveredCell = null;
    this.hoverScale = 1;
    this.hoveredEdges.clear();
  }

  reset() {
    this.clearHover();
    for (const [, edge] of this.grid.edges) {
      edge.pos = edge.rest;
      edge.velocity = 0;
      edge.force = 0;
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

    // State
    this.edgeGrid = null;
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
      for (const cell of this.edgeGrid.cells) {
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
    this.edgeGrid = new EdgeGrid(this.width, this.height, this.gap);
    this.edgeGrid.generate(this.subdivisionDepth, this.minCellSize);
    this.physics = new PhysicsEngine(this.edgeGrid);
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

    const gap = this.gap;
    const halfGap = gap / 2;
    const radius = 6;

    for (const cell of this.edgeGrid.cells) {
      const x = cell.x + halfGap;
      const y = cell.y + halfGap;
      const w = cell.width - gap;
      const h = cell.height - gap;

      if (w <= 0 || h <= 0) continue;

      const isHovered = cell === this.hoveredCell;

      // Check if any part is outside the original container bounds
      const isOutside = x < 0 || y < 0 || x + w > this.width || y + h > this.height;

      ctx.fillStyle = isHovered ? '#ef4444' : cell.color;
      ctx.globalAlpha = isOutside ? 0.5 : 0.9;

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();

      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Public API
  getShapeCount() {
    return this.edgeGrid ? this.edgeGrid.cells.length : 0;
  }

  getEdgeCount() {
    return this.edgeGrid ? this.edgeGrid.edges.size : 0;
  }

  setGap(gap) {
    this.gap = gap;
    if (this.edgeGrid) this.edgeGrid.gap = gap;
  }

  setHoverScale(scale) {
    this.hoverScale = scale;
  }

  setSubdivisionDepth(depth) {
    this.subdivisionDepth = depth;
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
      <div><span style="opacity:0.5">Edges:</span> ${bentoGrid.getEdgeCount()}</div>
    `;
  }
}

let bentoGrid;

function init() {
  bentoGrid = new BentoGrid('container');

  // Wire up all controls
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
    }
  };

  // Setup each control
  for (const [, ctrl] of Object.entries(controls)) {
    if (ctrl.el) {
      ctrl.el.addEventListener('input', (e) => {
        ctrl.handler(e.target.value);
        if (ctrl.display) ctrl.display.textContent = ctrl.format(e.target.value);
      });
    }
  }

  // Regenerate button
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
