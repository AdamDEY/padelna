import qrcode from "qrcode/lib/core/qrcode";
import { useMemo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

// design: dots with softly rounded corners, a little smaller than their cell. Rounder or smaller
// dots stopped the code decoding at some sizes in a test decoder, so these stay on the soft side.
const DOT_SIZE = 0.94;
const DOT_RADIUS = 0.2;
const DOT_OFFSET = (1 - DOT_SIZE) / 2;
// The three corner squares stay solid: scanners find the code by their 1:1:3:1:1 stripes, and
// broken-up squares are not found by every camera app (checked with a decoder).
const FINDER_SIZE = 7;
const FINDER_RADIUS = 1;
const FINDER_HOLE_RADIUS = 0.6;
// The logo in the middle (design: lime ball). Error correction Q and a logo of this size decode at
// every size in a test decoder; bigger logos failed.
const LOGO_RATIO = 0.2; // logo diameter as a share of the whole code
const LOGO_RING = 0.6; // white ring around the logo, in modules
const LOGO_CLEAR_GAP = 0.9; // dots this close to the logo are left out, in modules
const LOGO_ICON_RATIO = 0.55; // the ball mark inside the lime disc

/** A rounded rectangle as a path; several can share one `d` and fill with the even-odd rule. */
function roundedRect(x: number, y: number, width: number, height: number, radius: number) {
  const w = width - 2 * radius;
  const h = height - 2 * radius;
  return (
    `M${x + radius} ${y}h${w}a${radius} ${radius} 0 0 1 ${radius} ${radius}v${h}` +
    `a${radius} ${radius} 0 0 1 -${radius} ${radius}h-${w}a${radius} ${radius} 0 0 1 -${radius} -${radius}` +
    `v-${h}a${radius} ${radius} 0 0 1 ${radius} -${radius}z`
  );
}

type QrCodeProps = {
  /** The text to encode */
  value: string;
  /** Width and height in px */
  size: number;
  accessibilityLabel: string;
  /** Padelna's lime ball in the middle of the code */
  logo?: boolean;
};

/** A QR code drawn as rounded dots (design: "Profile code"), in the text colour. */
export function QrCode({ value, size, accessibilityLabel, logo = false }: QrCodeProps) {
  const ink = useCSSVariable("--color-foreground") as string;
  const lime = useCSSVariable("--color-lime") as string;
  const white = useCSSVariable("--color-surface") as string;
  // Medium error correction keeps the grid small; a logo covers some dots, so it needs more
  const { grid, dots, finders } = useMemo(() => {
    const { modules } = qrcode.create(value, { errorCorrectionLevel: logo ? "Q" : "M" });
    const middle = modules.size / 2;
    const clearRadius = (modules.size * LOGO_RATIO) / 2 + LOGO_CLEAR_GAP;
    const last = modules.size - FINDER_SIZE;
    const isFinder = (row: number, column: number) =>
      (row < FINDER_SIZE && column < FINDER_SIZE) ||
      (row < FINDER_SIZE && column >= last) ||
      (row >= last && column < FINDER_SIZE);

    let dotPath = "";
    for (let row = 0; row < modules.size; row++) {
      for (let column = 0; column < modules.size; column++) {
        const underLogo = logo && Math.hypot(column + 0.5 - middle, row + 0.5 - middle) < clearRadius;
        if (modules.get(row, column) && !isFinder(row, column) && !underLogo) {
          dotPath += roundedRect(column + DOT_OFFSET, row + DOT_OFFSET, DOT_SIZE, DOT_SIZE, DOT_RADIUS);
        }
      }
    }

    // Each corner square is a ring (outer minus hole) with a 3 × 3 block in the middle
    let finderPath = "";
    for (const [row, column] of [[0, 0], [0, last], [last, 0]]) {
      finderPath +=
        roundedRect(column, row, FINDER_SIZE, FINDER_SIZE, FINDER_RADIUS) +
        roundedRect(column + 1, row + 1, FINDER_SIZE - 2, FINDER_SIZE - 2, FINDER_HOLE_RADIUS) +
        roundedRect(column + 2, row + 2, FINDER_SIZE - 4, FINDER_SIZE - 4, FINDER_HOLE_RADIUS);
    }
    return { grid: modules.size, dots: dotPath, finders: finderPath };
  }, [value, logo]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Path d={dots} fill={ink} />
      {/* Even-odd: the ring's hole is empty, the block inside it fills again */}
      <Path d={finders} fill={ink} fillRule="evenodd" />
      {logo ? <Logo grid={grid} lime={lime} white={white} ink={ink} /> : null}
    </Svg>
  );
}

/** The lime ball mark on a white ring, drawn in the middle of the code's grid. */
function Logo({ grid, lime, white, ink }: { grid: number; lime: string; white: string; ink: string }) {
  const middle = grid / 2;
  const radius = (grid * LOGO_RATIO) / 2;
  const icon = radius * 2 * LOGO_ICON_RATIO;
  return (
    <>
      <Circle cx={middle} cy={middle} r={radius + LOGO_RING} fill={white} />
      <Circle cx={middle} cy={middle} r={radius} fill={lime} />
      {/* Same seams as PadelnaMark, on its 24-unit grid */}
      <G transform={`translate(${middle - icon / 2} ${middle - icon / 2}) scale(${icon / 24})`}>
        <Circle cx={12} cy={12} r={9} fill="none" stroke={ink} strokeWidth={1.8} />
        <Path
          d="M4.5 7.5c3 1.5 4.5 4 4.5 7.5M19.5 16.5c-3-1.5-4.5-4-4.5-7.5"
          fill="none"
          stroke={ink}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </G>
    </>
  );
}
