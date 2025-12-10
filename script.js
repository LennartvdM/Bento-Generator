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
// SPRING PHYSICS ENGINE WITH INCOMPRESSIBILITY
// ============================================

class PhysicsEngine {
  constructor(edgeGrid) {
    this.grid = edgeGrid;
    this.hoveredCell = null;

    // Physics parameters (tunable)
    this.springStrength = 0.15;      // How strongly edges return to rest
    this.damping = 0.82;             // Velocity decay (higher = more momentum)
    this.incompressibility = 0.7;    // How much cells resist compression (0-1)
    this.minSizeRatio = 0.5;         // Cells can't shrink below this ratio of rest size
    this.maxDisplacement = 150;      // Maximum edge movement from rest
    this.rippleIterations = 3;       // How many times to propagate compression per frame
  }

  applyHoverForce(cell, scale) {
    if (!cell) return;
    this.hoveredCell = cell;

    const expansion = scale - 1;
    if (expansion <= 0) return;

    const expandX = cell.restWidth * expansion;
    const expandY = cell.restHeight * expansion;

    // Push all 4 edges outward with strong force
    if (!cell.top.isFixed) {
      cell.top.force -= expandY * 1.5;
    }
    if (!cell.bottom.isFixed) {
      cell.bottom.force += expandY * 1.5;
    }
    if (!cell.left.isFixed) {
      cell.left.force -= expandX * 1.5;
    }
    if (!cell.right.isFixed) {
      cell.right.force += expandX * 1.5;
    }
  }

  // THE KEY: Cells resist compression by pushing their edges outward
  applyIncompressibility() {
    for (const cell of this.grid.cells) {
      // Skip the hovered cell - it's expanding, not compressed
      if (cell === this.hoveredCell) continue;

      const currentWidth = cell.width;
      const currentHeight = cell.height;
      const restWidth = cell.restWidth;
      const restHeight = cell.restHeight;

      // Calculate compression ratios
      const widthRatio = currentWidth / restWidth;
      const heightRatio = currentHeight / restHeight;

      // If compressed below threshold, push back
      if (widthRatio < this.minSizeRatio) {
        // Cell is too narrow - push left and right edges apart
        const deficit = restWidth * this.minSizeRatio - currentWidth;
        const force = deficit * this.incompressibility;

        if (!cell.left.isFixed) cell.left.force -= force;
        if (!cell.right.isFixed) cell.right.force += force;
      }

      if (heightRatio < this.minSizeRatio) {
        // Cell is too short - push top and bottom edges apart
        const deficit = restHeight * this.minSizeRatio - currentHeight;
        const force = deficit * this.incompressibility;

        if (!cell.top.isFixed) cell.top.force -= force;
        if (!cell.bottom.isFixed) cell.bottom.force += force;
      }

      // SOFT compression resistance (even above threshold)
      // This creates the ripple - cells push back proportionally to compression
      if (widthRatio < 1.0) {
        const compression = 1.0 - widthRatio;
        const softForce = compression * restWidth * this.incompressibility * 0.3;

        if (!cell.left.isFixed) cell.left.force -= softForce;
        if (!cell.right.isFixed) cell.right.force += softForce;
      }

      if (heightRatio < 1.0) {
        const compression = 1.0 - heightRatio;
        const softForce = compression * restHeight * this.incompressibility * 0.3;

        if (!cell.top.isFixed) cell.top.force -= softForce;
        if (!cell.bottom.isFixed) cell.bottom.force += softForce;
      }
    }
  }

  // Update edge positions based on forces
  integrateForces() {
    for (const [id, edge] of this.grid.edges) {
      if (edge.isFixed) continue;

      // Spring force toward rest position (keeps system stable)
      const springForce = (edge.rest - edge.pos) * this.springStrength;

      // Total force
      const totalForce = edge.force + springForce;

      // Update velocity with force
      edge.velocity += totalForce * 0.1;
      edge.velocity *= this.damping;

      // Update position
      edge.pos += edge.velocity;

      // Clamp displacement from rest
      const displacement = edge.pos - edge.rest;
      if (Math.abs(displacement) > this.maxDisplacement) {
        edge.pos = edge.rest + Math.sign(displacement) * this.maxDisplacement;
        edge.velocity *= 0.3;
      }

      // Reset force for next iteration
      edge.force = 0;
    }
  }

  // Prevent edges from crossing (cells inverting)
  enforceConstraints() {
    const minCellSize = 25;

    for (const cell of this.grid.cells) {
      // Ensure minimum width
      if (cell.width < minCellSize) {
        const mid = (cell.left.pos + cell.right.pos) / 2;
        if (!cell.left.isFixed) cell.left.pos = mid - minCellSize / 2;
        if (!cell.right.isFixed) cell.right.pos = mid + minCellSize / 2;
      }

      // Ensure minimum height
      if (cell.height < minCellSize) {
        const mid = (cell.top.pos + cell.bottom.pos) / 2;
        if (!cell.top.isFixed) cell.top.pos = mid - minCellSize / 2;
        if (!cell.bottom.isFixed) cell.bottom.pos = mid + minCellSize / 2;
      }
    }
  }

  update() {
    // Run multiple iterations of incompressibility per frame
    // This allows the ripple to propagate further each frame
    for (let i = 0; i < this.rippleIterations; i++) {
      this.applyIncompressibility();
      this.integrateForces();
    }

    // Final constraint enforcement
    this.enforceConstraints();
  }

  reset() {
    this.hoveredCell = null;
    for (const [id, edge] of this.grid.edges) {
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
    this.hoverScale = 1.35;
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
      // Apply hover force or clear it
      if (this.hoveredCell) {
        this.physics.applyHoverForce(this.hoveredCell, this.hoverScale);
      } else {
        this.physics.hoveredCell = null;
      }

      // Update physics (includes incompressibility ripple)
      this.physics.update();

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
  hoverScaleSlider.max = 2;
  hoverScaleSlider.step = 0.05;
  hoverScaleSlider.value = 1.35;
  hoverScaleValue.textContent = '1.35x';

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
