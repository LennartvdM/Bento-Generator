// Elastic Bento Grid Generator
// Constraint solver with smooth lerp animation

const PALETTE = [
  '#22d3ee', '#38bdf8', '#60a5fa', '#3b82f6', '#2563eb',
  '#34d399', '#10b981', '#14b8a6', '#06b6d4', '#0891b2',
  '#0ea5e9', '#0284c7', '#0d9488', '#059669', '#2dd4bf', '#5eead4'
];

// Get bento shape templates
function getBentoShapes() {
  const shapes = [];
  const sizes = [
    { w: 1, h: 1 }, { w: 2, h: 2 }, { w: 3, h: 3 },
    { w: 2, h: 1 }, { w: 3, h: 1 }, { w: 4, h: 1 },
    { w: 2, h: 3 }, { w: 3, h: 2 }, { w: 4, h: 2 },
    { w: 1, h: 2 }, { w: 1, h: 3 }, { w: 1, h: 4 },
    { w: 2, h: 4 }, { w: 3, h: 4 }, { w: 4, h: 3 }, { w: 4, h: 4 },
  ];
  
  sizes.forEach(size => {
    const blocks = [];
    for (let y = 0; y < size.h; y++) {
      for (let x = 0; x < size.w; x++) {
        blocks.push([x, y]);
      }
    }
    shapes.push({ name: `${size.w}x${size.h}`, blocks, width: size.w, height: size.h });
  });
  
  return shapes.sort((a, b) => (b.width * b.height) - (a.width * a.height));
}

// Generate grid with shapes
function generateGrid(width, height, gridScale, gap) {
  const cellSize = 50 * gridScale;
  const cols = Math.ceil(width / (cellSize + gap));
  const rows = Math.ceil(height / (cellSize + gap));
  const occupied = new Set();
  const shapes = [];
  const bentoShapes = getBentoShapes();
  
  const isOccupied = (r, c) => occupied.has(`${r},${c}`);
  
  const findEmptyCell = () => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isOccupied(r, c)) return { row: r, col: c };
      }
    }
    return null;
  };
  
  const tryPlace = (template, row, col) => {
    if (row + template.height > rows || col + template.width > cols) return null;
    const blockKeys = [];
    for (const [bx, by] of template.blocks) {
      const key = `${row + by},${col + bx}`;
      if (occupied.has(key)) return null;
      blockKeys.push(key);
    }
    return blockKeys;
  };
  
  let iterations = 0;
  const maxIterations = rows * cols * 10;
  
  while (iterations < maxIterations) {
    iterations++;
    const empty = findEmptyCell();
    if (!empty) break;
    
    const { row, col } = empty;
    let placed = false;
    const shuffled = [...bentoShapes].sort(() => Math.random() - 0.3);
    
    for (const template of shuffled) {
      const blockKeys = tryPlace(template, row, col);
      if (blockKeys) {
        blockKeys.forEach(k => occupied.add(k));
        
        // Position includes gap in grid calculation
        const baseX = col * (cellSize + gap);
        const baseY = row * (cellSize + gap);
        const baseW = template.width * cellSize + (template.width - 1) * gap;
        const baseH = template.height * cellSize + (template.height - 1) * gap;
        
        shapes.push({
          id: shapes.length,
          baseX, baseY, baseW, baseH,
          x: baseX, y: baseY,
          scale: 1,
          color: PALETTE[shapes.length % PALETTE.length],
          template
        });
        
        placed = true;
        break;
      }
    }
    
    if (!placed) {
      const key = `${row},${col}`;
      occupied.add(key);
      shapes.push({
        id: shapes.length,
        baseX: col * (cellSize + gap),
        baseY: row * (cellSize + gap),
        baseW: cellSize,
        baseH: cellSize,
        x: col * (cellSize + gap),
        y: row * (cellSize + gap),
        scale: 1,
        color: PALETTE[shapes.length % PALETTE.length],
        template: { name: '1x1', blocks: [[0,0]], width: 1, height: 1 }
      });
    }
  }
  
  return shapes;
}

// Constraint solver: shockwave + magnetic pull
function solveConstraints(shapes, hoveredId, hoverScale, gap) {
  // Reset everything to base
  shapes.forEach(s => {
    s.targetX = s.baseX;
    s.targetY = s.baseY;
    s.targetScale = s.id === hoveredId ? hoverScale : 1;
    s.pushX = 0;
    s.pushY = 0;
    s.wasPushed = false;
    s.priority = undefined;
    s.cornerCollapsed = false;
  });
  
  if (hoveredId === null) return;
  
  const hovered = shapes.find(s => s.id === hoveredId);
  if (!hovered) return;
  
  // How much hovered shape grows on each side
  const growX = (hovered.baseW * (hoverScale - 1)) / 2;
  const growY = (hovered.baseH * (hoverScale - 1)) / 2;
  
  const hCx = hovered.baseX + hovered.baseW / 2;
  const hCy = hovered.baseY + hovered.baseH / 2;
  const hL = hovered.baseX;
  const hR = hovered.baseX + hovered.baseW;
  const hT = hovered.baseY;
  const hB = hovered.baseY + hovered.baseH;
  
  // Scaled bounds
  const hsL = hCx - (hovered.baseW * hoverScale) / 2;
  const hsR = hCx + (hovered.baseW * hoverScale) / 2;
  const hsT = hCy - (hovered.baseH * hoverScale) / 2;
  const hsB = hCy + (hovered.baseH * hoverScale) / 2;
  
  // Assign priority levels: hovered = 0 (highest), then 1, 2, 3... (lower priority = further out)
  const hoveredShape = shapes.find(s => s.id === hoveredId);
  hoveredShape.priority = 0; // Highest priority
  
  // PHASE 1: Assign priority levels based on distance from hovered shape
  // Use BFS-like approach to assign priorities layer by layer
  const assigned = new Set([hoveredId]);
  let currentPriority = 1;
  let currentLayer = [hoveredId];
  
  while (currentLayer.length > 0 && currentPriority < 100) {
    const nextLayer = [];
    
    currentLayer.forEach(shapeId => {
      const shape = shapes.find(s => s.id === shapeId);
      if (!shape) return;
      
      const sL = shape.baseX, sR = shape.baseX + shape.baseW;
      const sT = shape.baseY, sB = shape.baseY + shape.baseH;
      
      shapes.forEach(neighbor => {
        if (assigned.has(neighbor.id) || neighbor.id === hoveredId) return;
        
        const nL = neighbor.baseX, nR = neighbor.baseX + neighbor.baseW;
        const nT = neighbor.baseY, nB = neighbor.baseY + neighbor.baseH;
        
        // Check if neighbor is adjacent (within gap distance)
        const vOverlap = Math.min(sB, nB) - Math.max(sT, nT);
        const hOverlap = Math.min(sR, nR) - Math.max(sL, nL);
        const gapBetweenX = vOverlap > 0 ? (sL > nR ? sL - nR : nL - sR) : Infinity;
        const gapBetweenY = hOverlap > 0 ? (sT > nB ? sT - nB : nT - sB) : Infinity;
        
        if ((vOverlap > 0 && gapBetweenX <= gap * 1.5) || 
            (hOverlap > 0 && gapBetweenY <= gap * 1.5)) {
          if (!assigned.has(neighbor.id)) {
            neighbor.priority = currentPriority;
            assigned.add(neighbor.id);
            nextLayer.push(neighbor.id);
          }
        }
      });
    });
    
    currentLayer = nextLayer;
    currentPriority++;
  }
  
  // Assign remaining shapes a very low priority
  shapes.forEach(s => {
    if (s.priority === undefined) {
      s.priority = 999;
    }
  });
  
  // PHASE 2: Push - direct neighbors of hovered shape move away
  shapes.forEach(s => {
    if (s.id === hoveredId) return;
    
    const sL = s.baseX, sR = s.baseX + s.baseW;
    const sT = s.baseY, sB = s.baseY + s.baseH;
    const sCx = s.baseX + s.baseW / 2;
    const sCy = s.baseY + s.baseH / 2;
    
    const vOverlap = Math.min(hB, sB) - Math.max(hT, sT);
    const hOverlap = Math.min(hR, sR) - Math.max(hL, sL);
    
    // Horizontal push
    if (vOverlap > 0) {
      if (sCx < hCx) { s.pushX = -growX; }
      else { s.pushX = growX; }
      s.wasPushed = true;
    }
    
    // Vertical push
    if (hOverlap > 0) {
      if (sCy < hCy) { s.pushY = -growY; }
      else { s.pushY = growY; }
      s.wasPushed = true;
    }
    
    // Corner forcefield
    if (vOverlap <= 0 && hOverlap <= 0) {
      const ffL = hsL - gap, ffR = hsR + gap;
      const ffT = hsT - gap, ffB = hsB + gap;
      const ffOverlapX = Math.min(ffR, sR) - Math.max(ffL, sL);
      const ffOverlapY = Math.min(ffB, sB) - Math.max(ffT, sT);
      
      if (ffOverlapX > 0 && ffOverlapY > 0) {
        s.pushX = sCx < hCx ? -growX : growX;
        s.pushY = sCy < hCy ? -growY : growY;
        s.wasPushed = true;
      }
    }
  });
  
  // Apply initial push
  shapes.forEach(s => {
    s.targetX += s.pushX;
    s.targetY += s.pushY;
  });
  
  // PHASE 2.5: Corner collision collapse - make diagonal pushes unstable
  // Deterministic coin flip based on shape ID to prevent jittering
  shapes.forEach(s => {
    if (s.id === hoveredId || !s.wasPushed) return;
    
    // Check if this shape was pushed diagonally (both X and Y)
    const wasDiagonalPush = Math.abs(s.pushX) > 0 && Math.abs(s.pushY) > 0;
    if (!wasDiagonalPush) return;
    
    // Check if already collapsed (one direction much smaller than other)
    const pushXRatio = Math.abs(s.pushX) / (Math.abs(s.pushX) + Math.abs(s.pushY) + 0.001);
    const alreadyCollapsed = pushXRatio < 0.2 || pushXRatio > 0.8;
    if (alreadyCollapsed) return; // Don't flip again if already committed
    
    // Deterministic coin flip based on shape ID and hovered ID (stable across frames)
    const seed = (s.id * 17 + (hoveredId || 0) * 31) % 100;
    const preferHorizontal = seed < 50;
    
    // FULLY commit - reduce other direction to near zero
    const collapseStrength = 0.85;
    if (preferHorizontal) {
      s.targetY -= s.pushY * collapseStrength;
      s.pushY *= (1 - collapseStrength);
    } else {
      s.targetX -= s.pushX * collapseStrength;
      s.pushX *= (1 - collapseStrength);
    }
    
    // Mark as corner-collapsed - gives it right of way to push other elements
    s.cornerCollapsed = true;
  });
  
  // PHASE 2.6: Corner-collapsed elements get right of way - push everything else away
  // Corner-collapsed elements are visually important and deserve to consolidate into their niche
  for (let pass = 0; pass < 10; pass++) {
    let hasOverlaps = false;
    
    shapes.forEach(collapsed => {
      if (!collapsed.cornerCollapsed || collapsed.id === hoveredId) return;
      
      const cL = collapsed.targetX, cR = collapsed.targetX + collapsed.baseW;
      const cT = collapsed.targetY, cB = collapsed.targetY + collapsed.baseH;
      
      shapes.forEach(other => {
        if (other.id === collapsed.id || other.id === hoveredId) return;
        
        const oL = other.targetX, oR = other.targetX + other.baseW;
        const oT = other.targetY, oB = other.targetY + other.baseH;
        
        // Check for overlap or gap violation
        const vOverlap = Math.min(cB, oB) - Math.max(cT, oT);
        const hOverlap = Math.min(cR, oR) - Math.max(cL, oL);
        
        if (vOverlap > 0 && hOverlap > 0) {
          // Actual overlap - push other away
          hasOverlaps = true;
          
          const cCx = collapsed.targetX + collapsed.baseW / 2;
          const cCy = collapsed.targetY + collapsed.baseH / 2;
          const oCx = other.targetX + other.baseW / 2;
          const oCy = other.targetY + other.baseH / 2;
          
          const dx = oCx - cCx;
          const dy = oCy - cCy;
          
          const overlapX = Math.min(cR, oR) - Math.max(cL, oL);
          const overlapY = Math.min(cB, oB) - Math.max(cT, oT);
          
          // Push other away to maintain gap
          const sepX = overlapX + gap;
          const sepY = overlapY + gap;
          
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
              other.targetX += sepX;
            } else {
              other.targetX -= sepX;
            }
          } else {
            if (dy > 0) {
              other.targetY += sepY;
            } else {
              other.targetY -= sepY;
            }
          }
        } else if (vOverlap > 0 || hOverlap > 0) {
          // Check gap violation (too close)
          const gapX = vOverlap > 0 ? (cL > oR ? cL - oR : oL - cR) : -1;
          const gapY = hOverlap > 0 ? (cT > oB ? cT - oB : oT - cB) : -1;
          
          if ((vOverlap > 0 && gapX < gap) || (hOverlap > 0 && gapY < gap)) {
            hasOverlaps = true;
            
            const cCx = collapsed.targetX + collapsed.baseW / 2;
            const cCy = collapsed.targetY + collapsed.baseH / 2;
            const oCx = other.targetX + other.baseW / 2;
            const oCy = other.targetY + other.baseH / 2;
            
            const dx = oCx - cCx;
            const dy = oCy - cCy;
            
            let sepX = 0, sepY = 0;
            if (vOverlap > 0 && gapX < gap) {
              sepX = gap - gapX;
            }
            if (hOverlap > 0 && gapY < gap) {
              sepY = gap - gapY;
            }
            
            if (Math.abs(dx) > Math.abs(dy) && sepX > 0) {
              if (dx > 0) {
                other.targetX += sepX;
              } else {
                other.targetX -= sepX;
              }
            } else if (sepY > 0) {
              if (dy > 0) {
                other.targetY += sepY;
              } else {
                other.targetY -= sepY;
              }
            }
          }
        }
      });
    });
    
    if (!hasOverlaps) break;
  }
  
  // PHASE 3: Cascading push - pushed shapes push their neighbors
  // No decay - all shapes get the same push amount
  // IMPORTANT: Only cascade to shapes that are within 1 priority level
  // This prevents long chains that pull in unrelated shapes
  for (let pass = 0; pass < 10; pass++) {
    shapes.forEach(puller => {
      if (!puller.wasPushed && puller.id !== hoveredId) return;
      if (puller.id === hoveredId) return;
      
      // Use ORIGINAL positions to check adjacency (prevents false neighbors)
      const pL = puller.baseX, pR = puller.baseX + puller.baseW;
      const pT = puller.baseY, pB = puller.baseY + puller.baseH;
      const pCx = puller.baseX + puller.baseW / 2;
      const pCy = puller.baseY + puller.baseH / 2;
      
      shapes.forEach(target => {
        if (target.wasPushed || target.id === hoveredId || target.id === puller.id) return;
        
        // CRITICAL: Only cascade to shapes that are within 1 priority level
        // This prevents long chains that pull in shapes far from the hovered element
        if (target.priority > puller.priority + 1) return;
        
        // Use ORIGINAL positions to check adjacency
        const tL = target.baseX, tR = target.baseX + target.baseW;
        const tT = target.baseY, tB = target.baseY + target.baseH;
        const tCx = target.baseX + target.baseW / 2;
        const tCy = target.baseY + target.baseH / 2;
        
        // Check if target was originally adjacent to puller (within reasonable distance)
        const vOverlap = Math.min(pB, tB) - Math.max(pT, tT);
        const hOverlap = Math.min(pR, tR) - Math.max(pL, tL);
        
        // Horizontal adjacency - check gap distance
        if (vOverlap > 0) {
          const gapBetween = pL > tR ? pL - tR : tL - pR;
          if (gapBetween >= 0 && gapBetween <= gap * 2) {
            const pushAmount = tCx < pCx ? -gap : gap;
            target.targetX += pushAmount;
            target.wasPushed = true;
            target.pushX = pushAmount;
          }
        }
        
        // Vertical adjacency
        if (hOverlap > 0) {
          const gapBetween = pT > tB ? pT - tB : tT - pB;
          if (gapBetween >= 0 && gapBetween <= gap * 2) {
            const pushAmount = tCy < pCy ? -gap : gap;
            target.targetY += pushAmount;
            target.wasPushed = true;
            target.pushY = pushAmount;
          }
        }
      });
    });
  }
  
  // PHASE 4: Priority-based gap enforcement
  // Higher priority shapes (lower number) push lower priority shapes (higher number)
  // Gap distance is enforced at all costs - no shapes can be closer than gap distance
  // BUT: Only enforce gaps between shapes that were originally neighbors
  // Track total movement to prevent excessive dragging
  shapes.forEach(s => {
    s.totalGapEnforcementX = 0;
    s.totalGapEnforcementY = 0;
  });
  
  for (let pass = 0; pass < 15; pass++) {
    let hasViolations = false;
    
    shapes.forEach(higherPriority => {
      if (higherPriority.id === hoveredId) return;
      
      const hL = higherPriority.targetX, hR = higherPriority.targetX + higherPriority.baseW;
      const hT = higherPriority.targetY, hB = higherPriority.targetY + higherPriority.baseH;
      
      // Original positions to check if they were neighbors
      const hLBase = higherPriority.baseX, hRBase = higherPriority.baseX + higherPriority.baseW;
      const hTBase = higherPriority.baseY, hBBase = higherPriority.baseY + higherPriority.baseH;
      
      shapes.forEach(lowerPriority => {
        // Only resolve if higherPriority has lower priority number (higher priority)
        if (lowerPriority.id === hoveredId || 
            lowerPriority.id === higherPriority.id ||
            higherPriority.priority >= lowerPriority.priority) return;
        
        // Check if these shapes were originally neighbors
        const lLBase = lowerPriority.baseX, lRBase = lowerPriority.baseX + lowerPriority.baseW;
        const lTBase = lowerPriority.baseY, lBBase = lowerPriority.baseY + lowerPriority.baseH;
        
        const vOverlapBase = Math.min(hBBase, lBBase) - Math.max(hTBase, lTBase);
        const hOverlapBase = Math.min(hRBase, lRBase) - Math.max(hLBase, lLBase);
        const gapBetweenXBase = vOverlapBase > 0 ? (hLBase > lRBase ? hLBase - lRBase : lLBase - hRBase) : Infinity;
        const gapBetweenYBase = hOverlapBase > 0 ? (hTBase > lBBase ? hTBase - lBBase : lTBase - hBBase) : Infinity;
        
        // ONLY enforce gap if they were originally neighbors (within gap*2)
        // This prevents "drag" effects between unrelated shapes in the cascade
        const wereNeighbors = (vOverlapBase > 0 && gapBetweenXBase <= gap * 2) || 
                              (hOverlapBase > 0 && gapBetweenYBase <= gap * 2);
        
        if (!wereNeighbors) return; // Skip if not originally neighbors
        
        const lL = lowerPriority.targetX, lR = lowerPriority.targetX + lowerPriority.baseW;
        const lT = lowerPriority.targetY, lB = lowerPriority.targetY + lowerPriority.baseH;
        
        // Check vertical overlap (for horizontal gap enforcement)
        const vOverlap = Math.min(hB, lB) - Math.max(hT, lT);
        // Check horizontal overlap (for vertical gap enforcement)
        const hOverlap = Math.min(hR, lR) - Math.max(hL, lL);
        
        // Calculate actual distances
        const gapX = vOverlap > 0 ? (hL > lR ? hL - lR : lL - hR) : -1;
        const gapY = hOverlap > 0 ? (hT > lB ? hT - lB : lT - hB) : -1;
        
        // Check if gap is violated (too close or overlapping)
        const gapViolatedX = vOverlap > 0 && gapX < gap;
        const gapViolatedY = hOverlap > 0 && gapY < gap;
        
        if (gapViolatedX || gapViolatedY) {
          hasViolations = true;
          
          const hCx = higherPriority.targetX + higherPriority.baseW / 2;
          const hCy = higherPriority.targetY + higherPriority.baseH / 2;
          const lCx = lowerPriority.targetX + lowerPriority.baseW / 2;
          const lCy = lowerPriority.targetY + lowerPriority.baseH / 2;
          
          const dx = lCx - hCx;
          const dy = lCy - hCy;
          
          // Calculate separation needed to enforce gap
          let sepX = 0, sepY = 0;
          
          if (gapViolatedX) {
            // Need to separate horizontally to maintain gap
            const currentGap = gapX < 0 ? 0 : gapX;
            sepX = gap - currentGap;
          }
          
          if (gapViolatedY) {
            // Need to separate vertically to maintain gap
            const currentGap = gapY < 0 ? 0 : gapY;
            sepY = gap - currentGap;
          }
          
          // Corner collision: if both X and Y separation needed, make it unstable
          // Deterministic coin flip to prevent jittering
          if (sepX > 0 && sepY > 0) {
            // Check if already collapsed
            const sepRatio = Math.abs(sepX) / (Math.abs(sepX) + Math.abs(sepY) + 0.001);
            const alreadyCollapsed = sepRatio < 0.2 || sepRatio > 0.8;
            if (!alreadyCollapsed) {
              // Deterministic coin flip based on shape IDs
              const seed = (lowerPriority.id * 17 + higherPriority.id * 31) % 100;
              const preferHorizontal = seed < 50;
              const collapseFactor = 0.85;
              if (preferHorizontal) {
                sepY *= (1 - collapseFactor);
              } else {
                sepX *= (1 - collapseFactor);
              }
            }
          }
          
          // Push lower priority shape away to enforce gap
          // But limit total movement to prevent excessive dragging (max 2x gap)
          if (Math.abs(dx) > Math.abs(dy) && sepX > 0) {
            const maxMoveX = gap * 2 - Math.abs(lowerPriority.totalGapEnforcementX || 0);
            const actualSepX = Math.min(sepX, maxMoveX);
            if (actualSepX > 0) {
              if (dx > 0) {
                lowerPriority.targetX += actualSepX;
                lowerPriority.totalGapEnforcementX = (lowerPriority.totalGapEnforcementX || 0) + actualSepX;
              } else {
                lowerPriority.targetX -= actualSepX;
                lowerPriority.totalGapEnforcementX = (lowerPriority.totalGapEnforcementX || 0) - actualSepX;
              }
            }
          } else if (sepY > 0) {
            const maxMoveY = gap * 2 - Math.abs(lowerPriority.totalGapEnforcementY || 0);
            const actualSepY = Math.min(sepY, maxMoveY);
            if (actualSepY > 0) {
              if (dy > 0) {
                lowerPriority.targetY += actualSepY;
                lowerPriority.totalGapEnforcementY = (lowerPriority.totalGapEnforcementY || 0) + actualSepY;
              } else {
                lowerPriority.targetY -= actualSepY;
                lowerPriority.totalGapEnforcementY = (lowerPriority.totalGapEnforcementY || 0) - actualSepY;
              }
            }
          }
        }
      });
    });
    
    // Also check gap violations with hovered shape (highest priority)
    shapes.forEach(shape => {
      if (shape.id === hoveredId) return;
      
      const sL = shape.targetX, sR = shape.targetX + shape.baseW;
      const sT = shape.targetY, sB = shape.targetY + shape.baseH;
      
      // Check vertical overlap (for horizontal gap enforcement)
      const vOverlap = Math.min(hsB, sB) - Math.max(hsT, sT);
      // Check horizontal overlap (for vertical gap enforcement)
      const hOverlap = Math.min(hsR, sR) - Math.max(hsL, sL);
      
      // Calculate actual distances
      const gapX = vOverlap > 0 ? (hsL > sR ? hsL - sR : sL - hsR) : -1;
      const gapY = hOverlap > 0 ? (hsT > sB ? hsT - sB : sT - hsB) : -1;
      
      // Check if gap is violated (too close or overlapping)
      const gapViolatedX = vOverlap > 0 && gapX < gap;
      const gapViolatedY = hOverlap > 0 && gapY < gap;
      
      if (gapViolatedX || gapViolatedY) {
        hasViolations = true;
        
        const sCx = shape.targetX + shape.baseW / 2;
        const sCy = shape.targetY + shape.baseH / 2;
        const dx = sCx - hCx;
        const dy = sCy - hCy;
        
        // Calculate separation needed to enforce gap
        let sepX = 0, sepY = 0;
        
        if (gapViolatedX) {
          const currentGap = gapX < 0 ? 0 : gapX;
          sepX = gap - currentGap;
        }
        
        if (gapViolatedY) {
          const currentGap = gapY < 0 ? 0 : gapY;
          sepY = gap - currentGap;
        }
        
        // Push shape away from hovered to enforce gap
        if (Math.abs(dx) > Math.abs(dy) && sepX > 0) {
          if (dx > 0) {
            shape.targetX += sepX;
          } else {
            shape.targetX -= sepX;
          }
        } else if (sepY > 0) {
          if (dy > 0) {
            shape.targetY += sepY;
          } else {
            shape.targetY -= sepY;
          }
        }
      }
    });
    
    if (!hasViolations) break;
  }
}

// Main application
class BentoGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    
    this.gridScale = 1;
    this.gap = 8;
    this.hoverScale = 1.08;
    this.shapes = [];
    this.hoveredId = null;
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
    
    // Add padding around canvas so shapes can extend outside container
    const padding = 200;
    this.canvas.width = this.width + padding * 2;
    this.canvas.height = this.height + padding * 2;
    
    // Store offset for coordinate translation
    this.canvasOffsetX = padding;
    this.canvasOffsetY = padding;
    
    // Position canvas to center it in container
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
      // Account for canvas offset (padding)
      const mx = e.clientX - rect.left - (this.canvasOffsetX || 0);
      const my = e.clientY - rect.top - (this.canvasOffsetY || 0);
      
      let found = null;
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const s = this.shapes[i];
        const cx = s.x + s.baseW / 2;
        const cy = s.y + s.baseH / 2;
        const w = s.baseW * s.scale;
        const h = s.baseH * s.scale;
        if (mx >= cx - w/2 && mx <= cx + w/2 && my >= cy - h/2 && my <= cy + h/2) {
          found = s.id;
          break;
        }
      }
      this.hoveredId = found;
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredId = null;
    });
  }
  
  regenerate() {
    this.shapes = generateGrid(this.width, this.height, this.gridScale, this.gap);
    // Initialize target positions
    this.shapes.forEach(s => {
      s.targetX = s.baseX;
      s.targetY = s.baseY;
      s.targetScale = 1;
    });
  }
  
  startAnimation() {
    const lerpSpeed = 0.18;
    
    const tick = () => {
      // Solve constraints to find target positions
      solveConstraints(this.shapes, this.hoveredId, this.hoverScale, this.gap);
      
      // Smooth lerp to targets
      this.shapes.forEach(s => {
        s.x += (s.targetX - s.x) * lerpSpeed;
        s.y += (s.targetY - s.y) * lerpSpeed;
        s.scale += (s.targetScale - s.scale) * lerpSpeed;
      });
      
      // Render
      this.render();
      
      this.animId = requestAnimationFrame(tick);
    };
    
    tick();
  }
  
  render() {
    // Clear entire canvas (including padding area)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Translate coordinate system to account for padding
    this.ctx.save();
    this.ctx.translate(this.canvasOffsetX, this.canvasOffsetY);
    
    this.shapes.forEach(s => {
      const cx = s.x + s.baseW / 2;
      const cy = s.y + s.baseH / 2;
      const w = s.baseW * s.scale;
      const h = s.baseH * s.scale;
      const rx = cx - w / 2;
      const ry = cy - h / 2;
      const radius = 6;
      
      // Check if shape is outside container boundaries
      const isOutside = rx < 0 || ry < 0 || rx + w > this.width || ry + h > this.height;
      
      this.ctx.fillStyle = s.id === this.hoveredId ? '#ef4444' : s.color;
      
      if (isOutside) {
        this.ctx.globalAlpha = 0.5;
        this.ctx.globalCompositeOperation = 'multiply';
      } else {
        this.ctx.globalAlpha = 0.9;
        this.ctx.globalCompositeOperation = 'source-over';
      }
      
      this.ctx.beginPath();
      
      // Draw rounded rectangle (polyfill for roundRect)
      this.ctx.moveTo(rx + radius, ry);
      this.ctx.lineTo(rx + w - radius, ry);
      this.ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + radius);
      this.ctx.lineTo(rx + w, ry + h - radius);
      this.ctx.quadraticCurveTo(rx + w, ry + h, rx + w - radius, ry + h);
      this.ctx.lineTo(rx + radius, ry + h);
      this.ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - radius);
      this.ctx.lineTo(rx, ry + radius);
      this.ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      this.ctx.closePath();
      
      this.ctx.fill();
      
      this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });
    
    // Restore coordinate system
    this.ctx.restore();
    
    // Reset to defaults
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }
  
  getShapeCount() {
    return this.shapes.length;
  }
  
  getCellSize() {
    return 50 * this.gridScale;
  }
  
  setGridScale(scale) {
    this.gridScale = scale;
    this.regenerate();
  }
  
  setGap(gap) {
    this.gap = gap;
    this.regenerate();
  }
  
  setHoverScale(scale) {
    this.hoverScale = scale;
  }
}

// Update metrics display
function updateMetrics() {
  if (!bentoGrid) return;
  
  const metricsEl = document.getElementById('metrics');
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div>Shapes</div><div>${bentoGrid.getShapeCount()}</div>
      <div>Cell Size</div><div>${bentoGrid.getCellSize().toFixed(0)}px</div>
      <div>Gap</div><div>${bentoGrid.gap}px</div>
    `;
  }
}

// Initialize
let bentoGrid;
let gridScaleSlider, gapSlider, hoverScaleSlider;
let gridScaleValue, gapValue, hoverScaleValue;

function init() {
  bentoGrid = new BentoGrid('container');
  
  // Setup sliders
  gridScaleSlider = document.getElementById('gridScale');
  gridScaleValue = document.getElementById('gridScaleValue');
  gapSlider = document.getElementById('gap');
  gapValue = document.getElementById('gapValue');
  hoverScaleSlider = document.getElementById('hoverScale');
  hoverScaleValue = document.getElementById('hoverScaleValue');
  
  gridScaleSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    gridScaleValue.textContent = val.toFixed(1);
    bentoGrid.setGridScale(val);
    updateMetrics();
  });
  
  gapSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    gapValue.textContent = val;
    bentoGrid.setGap(val);
    updateMetrics();
  });
  
  hoverScaleSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    hoverScaleValue.textContent = val.toFixed(2) + 'x';
    bentoGrid.setHoverScale(val);
  });
  
  document.getElementById('regen').addEventListener('click', () => {
    bentoGrid.regenerate();
    updateMetrics();
  });
  
  // Initial metrics update
  updateMetrics();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
