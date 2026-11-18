/* ===== Coming soon page: torch + falling stars ===== */
/* All distances are in Figma units: the page is 1440 units wide, whatever the screen size */

const FIGMA_WIDTH = 1440;
const TORCH_EASE = 0.22;      // how fast the torch follows the mouse (0-1)
const STARS_PER_CLICK = 14;   // how many stars each click throws
const GRAVITY = 0.45;         // pull downward while falling
const FLOOR_GAP = 2;          // the floor sits this far above the bottom of the page
const COLUMN_WIDTH = 12;      // the pile map is split into columns this wide
const MAX_STEP = 16;          // biggest height difference between columns before a star rolls. Bigger = steeper piles
const WALL = 8;               // stars bounce off the sides this far from the edge

const page = document.querySelector(".coming-soon");
const torch = document.querySelector(".torch");
const fallingLayer = document.querySelector(".falling-stars");
const floorGroup = document.querySelector(".falling-stars-floor");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Read the sizes from styles.css
const styles = getComputedStyle(document.documentElement);
const TORCH_RADIUS = parseFloat(styles.getPropertyValue("--torch-radius"));
const STAR_SIZE_MIN = parseFloat(styles.getPropertyValue("--falling-star-size-min"));
const STAR_SIZE_MAX = parseFloat(styles.getPropertyValue("--falling-star-size-max"));

/* ===== Page size ===== */
// scale = screen pixels per Figma unit
let scale = 1;

function measurePage() {
  const box = page.getBoundingClientRect();
  scale = box.width / FIGMA_WIDTH;
  const height = box.height / scale;
  // The falling stars layer uses Figma units. y = 0 is the floor, so piles stay on the floor when the window changes size
  fallingLayer.setAttribute("viewBox", `0 0 ${FIGMA_WIDTH} ${height}`);
  floorGroup.setAttribute("transform", `translate(0, ${height - FLOOR_GAP})`);
}
measurePage();
window.addEventListener("resize", measurePage);

/* ===== Torch ===== */
const torchTarget = { x: 0, y: 0 };
const torchNow = { x: 0, y: 0 };
let torchVisible = false;

// The torch appears right under the mouse at full size. No grow animation and no sliding in from the edge
function showTorchAt(x, y) {
  torchTarget.x = torchNow.x = x;
  torchTarget.y = torchNow.y = y;
  torchVisible = true;
}

// The torch disappears at once. No shrink animation
function hideTorch() {
  torchVisible = false;
}

document.addEventListener("pointermove", (event) => {
  if (!torchVisible) {
    showTorchAt(event.clientX, event.clientY);
    return;
  }
  torchTarget.x = event.clientX;
  torchTarget.y = event.clientY;
});

// On a touch screen the torch jumps straight to the finger
document.addEventListener("pointerdown", (event) => {
  showTorchAt(event.clientX, event.clientY);
});

// The mouse left the browser window
document.addEventListener("mouseout", (event) => {
  if (!event.relatedTarget) hideTorch();
});
document.documentElement.addEventListener("pointerleave", hideTorch);
window.addEventListener("blur", hideTorch);

function drawTorch() {
  torchNow.x += (torchTarget.x - torchNow.x) * TORCH_EASE;
  torchNow.y += (torchTarget.y - torchNow.y) * TORCH_EASE;
  // Size the circle in real pixels so its edge stays sharp
  const radiusInPixels = torchVisible ? TORCH_RADIUS * scale : 0;
  torch.style.width = torch.style.height = `${radiusInPixels * 2}px`;
  torch.style.transform = `translate(${torchNow.x - radiusInPixels}px, ${torchNow.y - radiusInPixels}px)`;
}

/* ===== Piles ===== */
// heights[c] = how tall the pile is in column c
// Exactly as many columns as fit the page, so the last column touches the right wall and stars can rest there
const columnCount = Math.ceil(FIGMA_WIDTH / COLUMN_WIDTH);
const heights = new Array(columnCount).fill(0);

const columnOf = (x) => Math.max(0, Math.min(columnCount - 1, Math.floor(x / COLUMN_WIDTH)));
// Where a star of this size touches the pile in column c (the floor is y = 0, up is negative)
const surfaceY = (c, size) => -heights[c] - size * 6;

// Which way a star rolls: -1 left, 1 right, 0 = it can stay
function slopeDirection(c) {
  const left = c > 0 ? heights[c - 1] : Infinity;
  const right = c < columnCount - 1 ? heights[c + 1] : Infinity;
  const dropLeft = heights[c] - left;
  const dropRight = heights[c] - right;
  if (dropLeft > MAX_STEP && dropRight > MAX_STEP) return dropLeft > dropRight ? -1 : 1;
  if (dropLeft > MAX_STEP) return -1;
  if (dropRight > MAX_STEP) return 1;
  return 0;
}

/* ===== Falling stars ===== */
let movingStars = []; // only stars that are still moving. Stars at rest stay on the page forever

const SVG_NS = "http://www.w3.org/2000/svg";

// Throw stars from a point (in Figma units, y measured from the floor)
function burst(x, y) {
  for (let i = 0; i < STARS_PER_CLICK; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2; // mostly upward
    const speed = 4 + Math.random() * 8;
    const star = {
      element: document.createElementNS(SVG_NS, "use"),
      state: "fall",
      x,
      y,
      size: STAR_SIZE_MIN + Math.random() * (STAR_SIZE_MAX - STAR_SIZE_MIN), // different sizes
      vx: Math.cos(angle) * speed * 0.7,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 12,
    };
    star.element.setAttribute("href", "#falling-star");
    floorGroup.appendChild(star.element);

    if (reduceMotion) {
      // Reduced motion: work out where the star ends up and show it there right away
      let steps = 0;
      while (moveStar(star) && steps < 10000) steps++;
      drawStar(star);
    } else {
      drawStar(star);
      movingStars.push(star);
    }
  }
}

function drawStar(star) {
  star.element.setAttribute(
    "transform",
    `translate(${star.x.toFixed(1)}, ${star.y.toFixed(1)}) rotate(${star.rotation.toFixed(1)}) scale(${star.size})`
  );
}

// Moves a star one step. Returns false when the star has come to rest
function moveStar(star) {
  if (star.state === "fall") {
    star.vy += GRAVITY;
    star.vx *= 0.99;
    star.x += star.vx;
    star.y += star.vy;
    star.rotation += star.spin;
    if (star.x < WALL) { star.x = WALL; star.vx *= -0.5; }
    if (star.x > FIGMA_WIDTH - WALL) { star.x = FIGMA_WIDTH - WALL; star.vx *= -0.5; }

    const floor = surfaceY(columnOf(star.x), star.size);
    if (star.vy > 0 && star.y >= floor) {
      // Lands exactly on the surface: no sinking and no bounce
      star.y = floor;
      star.state = "slide";
      star.vx *= 0.35;
      star.vy = 0;
      star.spin *= 0.3;
    }
    return true;
  }

  // Rolls down the pile until it finds a steady spot, slowing down as it goes
  const direction = slopeDirection(columnOf(star.x));
  if (direction) star.vx += direction * 0.55;
  else star.vx *= 0.72;
  star.vx = Math.max(-5, Math.min(5, star.vx));
  star.x = Math.max(WALL - 2, Math.min(FIGMA_WIDTH - WALL + 2, star.x + star.vx));

  const floor = surfaceY(columnOf(star.x), star.size);
  if (star.y < floor - 0.5) {
    // Drops off the edge of a pile
    star.vy += GRAVITY;
    star.y = Math.min(floor, star.y + star.vy);
  } else {
    star.y = floor;
    star.vy = 0;
  }
  star.rotation += star.vx * 5 + star.spin;
  star.spin *= 0.85;

  if (!direction && Math.abs(star.vx) < 0.12 && star.y >= floor - 0.5) {
    // The star is at rest: the pile under it grows
    const c = columnOf(star.x);
    heights[c] += star.size * 15;
    star.y = -heights[c] + star.size * 9;
    return false;
  }
  return true;
}

// Clicking one of the three star drawings (and only them) throws stars from its center
document.querySelectorAll("[data-burst]").forEach((starDrawing) => {
  starDrawing.addEventListener("pointerdown", () => {
    const pageBox = page.getBoundingClientRect();
    const starBox = starDrawing.getBoundingClientRect();
    const x = (starBox.left + starBox.width / 2 - pageBox.left) / scale;
    const y = (starBox.top + starBox.height / 2 - pageBox.bottom) / scale + FLOOR_GAP;
    burst(x, y);
  });
});

/* ===== Animation loop ===== */
function frame() {
  drawTorch();
  movingStars = movingStars.filter((star) => {
    const stillMoving = moveStar(star);
    drawStar(star);
    return stillMoving;
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
