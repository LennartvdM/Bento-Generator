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
  constructor(id, position, isHorizontal, isFixed = false) {
    this.id = id;
    this.isHorizontal = isHorizontal; // horizontal edges have y position, vertical have x
    this.isFixed = isFixed; // boundary edges don't move

    // Physics state
    this.rest = position;      // where it wants to be
    this.pos = position;       // current position
    this.target = position;    // target for lerping
    this.velocity = 0;
    this.force = 0;

    // Connections to other edges (for force propagation)
    this.connectedEdges = new Set();
  }

  // Get position value (y for horizontal, x for vertical)
  get value() {
    return this.pos;
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

  // Derived properties from edges
  get x() { return this.left.pos; }
  get y() { return this.top.pos; }
  get width() { return this.right.pos - this.left.pos; }
  get height() { return this.bottom.pos - this.top.pos; }

  get restX() { return this.left.rest; }
  get restY() { return this.top.rest; }
  get restWidth() { return this.right.rest - this.left.rest; }
  get restHeight() { return this.bottom.rest - this.top.rest; }

  get centerX() { return this.x + this.width / 2; }
  get centerY() { return this.y + this.height / 2; }

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

    this.edges = new Map();     // id -> Edge
    this.cells = [];            // Cell[]
    this.edgeIdCounter = 0;

    // Create boundary edges (fixed)
    this.topBoundary = this.createEdge(0, true, true);
    this.bottomBoundary = this.createEdge(height, true, true);
    this.leftBoundary = this.createEdge(0, false, true);
    this.rightBoundary = this.createEdge(width, false, true);
  }

  createEdge(position, isHorizontal, isFixed = false) {
    const id = `e${this.edgeIdCounter++}`;
    const edge = new Edge(id, position, isHorizontal, isFixed);
    this.edges.set(id, edge);
    return edge;
  }

  // Recursive binary space partition
  subdivide(topEdge, bottomEdge, leftEdge, rightEdge, depth, minSize) {
    const width = rightEdge.rest - leftEdge.rest;
    const height = bottomEdge.rest - topEdge.rest;

    // Stop conditions
    if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
      // Create a cell
      const cell = new Cell(
        this.cells.length,
        topEdge, bottomEdge, leftEdge, rightEdge
      );
      this.cells.push(cell);
      return;
    }

    // Decide split direction based on aspect ratio and randomness
    const aspectRatio = width / height;
    let splitHorizontal;

    if (width < minSize * 1.5) {
      splitHorizontal = true; // Force horizontal split
    } else if (height < minSize * 1.5) {
      splitHorizontal = false; // Force vertical split
    } else {
      // Bias toward splitting the longer dimension
      const horizontalBias = aspectRatio < 1 ? 0.7 : 0.3;
      splitHorizontal = Math.random() < horizontalBias;
    }

    // Random split ratio (avoid extremes)
    const splitRatio = 0.3 + Math.random() * 0.4;

    if (splitHorizontal) {
      // Create horizontal split edge
      const splitY = topEdge.rest + (bottomEdge.rest - topEdge.rest) * splitRatio;
      const splitEdge = this.createEdge(splitY, true, false);

      // Connect edges (for force propagation)
      splitEdge.connectedEdges.add(leftEdge.id);
      splitEdge.connectedEdges.add(rightEdge.id);
      leftEdge.connectedEdges.add(splitEdge.id);
      rightEdge.connectedEdges.add(splitEdge.id);

      // Recurse
      this.subdivide(topEdge, splitEdge, leftEdge, rightEdge, depth - 1, minSize);
      this.subdivide(splitEdge, bottomEdge, leftEdge, rightEdge, depth - 1, minSize);
    } else {
      // Create vertical split edge
      const splitX = leftEdge.rest + (rightEdge.rest - leftEdge.rest) * splitRatio;
      const splitEdge = this.createEdge(splitX, false, false);

      // Connect edges
      splitEdge.connectedEdges.add(topEdge.id);
      splitEdge.connectedEdges.add(bottomEdge.id);
      topEdge.connectedEdges.add(splitEdge.id);
      bottomEdge.connectedEdges.add(splitEdge.id);

      // Recurse
      this.subdivide(topEdge, bottomEdge, leftEdge, splitEdge, depth - 1, minSize);
      this.subdivide(topEdge, bottomEdge, splitEdge, rightEdge, depth - 1, minSize);
    }
  }

  generate(subdivisionDepth = 5, minCellSize = 60) {
    this.cells = [];
    // Reset edges except boundaries
    const boundaryIds = new Set([
      this.topBoundary.id, this.bottomBoundary.id,
      this.leftBoundary.id, this.rightBoundary.id
    ]);

    for (const [id, edge] of this.edges) {
      if (!boundaryIds.has(id)) {
        this.edges.delete(id);
      }
    }

    // Clear connections on boundaries
    this.topBoundary.connectedEdges.clear();
    this.bottomBoundary.connectedEdges.clear();
    this.leftBoundary.connectedEdges.clear();
    this.rightBoundary.connectedEdges.clear();

    // Start subdivision
    this.subdivide(
      this.topBoundary, this.bottomBoundary,
      this.leftBoundary, this.rightBoundary,
      subdivisionDepth, minCellSize
    );

    // Apply gap by adjusting rest positions
    this.applyGap();
  }

  applyGap() {
    const halfGap = this.gap / 2;

    this.cells.forEach(cell => {
      // Shrink each cell by half-gap on each side
      // We do this by storing an inset amount on each cell
      cell.inset = halfGap;
    });
  }
}

// ============================================
// SPRING PHYSICS ENGINE
// ============================================

class PhysicsEngine {
  constructor(edgeGrid) {
    this.grid = edgeGrid;

    // Physics parameters (tunable)
    this.springStrength = 0.3;    // How strongly edges return to rest
    this.damping = 0.75;          // Velocity decay
    this.forcePropagation = 0.6;  // How much force transfers to connected edges
    this.maxDisplacement = 100;   // Maximum edge movement from rest
  }

  applyHoverForce(cell, scale) {
    if (!cell) return;

    const expansion = scale - 1;
    if (expansion <= 0) return;

    const expandX = cell.restWidth * expansion * 0.5;
    const expandY = cell.restHeight * expansion * 0.5;

    // Push all 4 edges outward
    if (!cell.top.isFixed) {
      cell.top.force -= expandY * 2;
    }
    if (!cell.bottom.isFixed) {
      cell.bottom.force += expandY * 2;
    }
    if (!cell.left.isFixed) {
      cell.left.force -= expandX * 2;
    }
    if (!cell.right.isFixed) {
      cell.right.force += expandX * 2;
    }
  }

  propagateForces() {
    // Forces ripple through connected edges
    const propagated = new Map();

    // Collect forces to propagate
    for (const [id, edge] of this.grid.edges) {
      if (Math.abs(edge.force) > 0.01) {
        for (const connectedId of edge.connectedEdges) {
          const connected = this.grid.edges.get(connectedId);
          if (connected && !connected.isFixed) {
            // Only propagate to edges of the same orientation
            if (connected.isHorizontal === edge.isHorizontal) {
              const key = connectedId;
              const current = propagated.get(key) || 0;
              propagated.set(key, current + edge.force * this.forcePropagation * 0.3);
            }
          }
        }
      }
    }

    // Apply propagated forces
    for (const [id, force] of propagated) {
      const edge = this.grid.edges.get(id);
      if (edge) {
        edge.force += force;
      }
    }
  }

  enforceMinimumCellSizes(minSize = 30) {
    // Ensure no cell gets too small by applying corrective forces
    for (const cell of this.grid.cells) {
      const width = cell.right.pos - cell.left.pos;
      const height = cell.bottom.pos - cell.top.pos;

      if (width < minSize) {
        const correction = (minSize - width) * 0.5;
        if (!cell.left.isFixed) cell.left.force -= correction;
        if (!cell.right.isFixed) cell.right.force += correction;
      }

      if (height < minSize) {
        const correction = (minSize - height) * 0.5;
        if (!cell.top.isFixed) cell.top.force -= correction;
        if (!cell.bottom.isFixed) cell.bottom.force += correction;
      }
    }
  }

  enforceEdgeOrder() {
    // Ensure edges don't cross each other
    // Group edges by their role and enforce ordering

    // For each cell, ensure top < bottom and left < right
    for (const cell of this.grid.cells) {
      const minGap = 20;

      if (cell.bottom.pos - cell.top.pos < minGap) {
        const mid = (cell.top.pos + cell.bottom.pos) / 2;
        if (!cell.top.isFixed) cell.top.target = Math.min(cell.top.target, mid - minGap/2);
        if (!cell.bottom.isFixed) cell.bottom.target = Math.max(cell.bottom.target, mid + minGap/2);
      }

      if (cell.right.pos - cell.left.pos < minGap) {
        const mid = (cell.left.pos + cell.right.pos) / 2;
        if (!cell.left.isFixed) cell.left.target = Math.min(cell.left.target, mid - minGap/2);
        if (!cell.right.isFixed) cell.right.target = Math.max(cell.right.target, mid + minGap/2);
      }
    }
  }

  update() {
    // Propagate forces through the network
    this.propagateForces();

    // Enforce minimum cell sizes
    this.enforceMinimumCellSizes();

    // Update each edge
    for (const [id, edge] of this.grid.edges) {
      if (edge.isFixed) continue;

      // Spring force toward rest position
      const springForce = (edge.rest - edge.pos) * this.springStrength;

      // Total force
      const totalForce = edge.force + springForce;

      // Update velocity
      edge.velocity += totalForce;
      edge.velocity *= this.damping;

      // Calculate target position
      edge.target = edge.pos + edge.velocity;

      // Clamp displacement from rest
      const displacement = edge.target - edge.rest;
      if (Math.abs(displacement) > this.maxDisplacement) {
        edge.target = edge.rest + Math.sign(displacement) * this.maxDisplacement;
        edge.velocity *= 0.5; // Dampen when hitting limit
      }

      // Reset force for next frame
      edge.force = 0;
    }

    // Enforce edge ordering constraints
    this.enforceEdgeOrder();
  }

  lerp(lerpSpeed = 0.15) {
    // Smooth interpolation to target
    for (const [id, edge] of this.grid.edges) {
      if (edge.isFixed) continue;
      edge.pos += (edge.target - edge.pos) * lerpSpeed;
    }
  }

  reset() {
    // Reset all edges to rest position
    for (const [id, edge] of this.grid.edges) {
      edge.pos = edge.rest;
      edge.target = edge.rest;
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
    this.hoverScale = 1.15;
    this.subdivisionDepth = 5;
    this.minCellSize = 80;

    // State
    this.edgeGrid = null;
    this.physics = null;
    this.hoveredCell = null;
    this.animId = null;
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

    // Add padding around canvas
    const padding = 150;
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

      // Find hovered cell
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
    // Create new edge grid
    this.edgeGrid = new EdgeGrid(this.width, this.height, this.gap);
    this.edgeGrid.generate(this.subdivisionDepth, this.minCellSize);

    // Create physics engine
    this.physics = new PhysicsEngine(this.edgeGrid);
    this.physics.reset();
  }

  startAnimation() {
    const tick = () => {
      // Apply hover force
      if (this.hoveredCell) {
        this.physics.applyHoverForce(this.hoveredCell, this.hoverScale);
      }

      // Update physics
      this.physics.update();
      this.physics.lerp(0.12);

      // Render
      this.render();

      this.animId = requestAnimationFrame(tick);
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

    // Draw cells
    for (const cell of this.edgeGrid.cells) {
      // Apply gap inset
      const x = cell.x + halfGap;
      const y = cell.y + halfGap;
      const w = cell.width - gap;
      const h = cell.height - gap;

      if (w <= 0 || h <= 0) continue;

      const isHovered = cell === this.hoveredCell;

      // Check if outside container
      const isOutside = x < 0 || y < 0 || x + w > this.width || y + h > this.height;

      ctx.fillStyle = isHovered ? '#ef4444' : cell.color;
      ctx.globalAlpha = isOutside ? 0.4 : 0.9;

      // Draw rounded rectangle
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

      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
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
    if (this.edgeGrid) {
      this.edgeGrid.gap = gap;
    }
  }

  setHoverScale(scale) {
    this.hoverScale = scale;
  }

  setSubdivisionDepth(depth) {
    this.subdivisionDepth = depth;
    this.regenerate();
  }

  setMinCellSize(size) {
    this.minCellSize = size;
    this.regenerate();
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
      <div>Cells</div><div>${bentoGrid.getShapeCount()}</div>
      <div>Edges</div><div>${bentoGrid.getEdgeCount()}</div>
      <div>Gap</div><div>${bentoGrid.gap}px</div>
    `;
  }
}

let bentoGrid;

function init() {
  bentoGrid = new BentoGrid('container');

  // Setup sliders
  const gridScaleSlider = document.getElementById('gridScale');
  const gridScaleValue = document.getElementById('gridScaleValue');
  const gapSlider = document.getElementById('gap');
  const gapValue = document.getElementById('gapValue');
  const hoverScaleSlider = document.getElementById('hoverScale');
  const hoverScaleValue = document.getElementById('hoverScaleValue');

  // Repurpose gridScale slider for subdivision depth
  gridScaleSlider.min = 3;
  gridScaleSlider.max = 7;
  gridScaleSlider.step = 1;
  gridScaleSlider.value = 5;
  gridScaleValue.textContent = '5';

  // Update label
  const scaleLabel = gridScaleSlider.previousElementSibling;
  if (scaleLabel) scaleLabel.textContent = 'Depth:';

  gridScaleSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    gridScaleValue.textContent = val;
    bentoGrid.setSubdivisionDepth(val);
    updateMetrics();
  });

  gapSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    gapValue.textContent = val;
    bentoGrid.setGap(val);
  });

  // Increase hover scale range for more dramatic effect
  hoverScaleSlider.min = 1;
  hoverScaleSlider.max = 1.5;
  hoverScaleSlider.value = 1.15;
  hoverScaleValue.textContent = '1.15x';

  hoverScaleSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    hoverScaleValue.textContent = val.toFixed(2) + 'x';
    bentoGrid.setHoverScale(val);
  });

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
