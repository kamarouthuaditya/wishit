import type { SVGProps } from 'react';

/**
 * Stroke icons, 1.5px, drawn on a 24 grid and rendered at 16 or 20.
 *
 * Inline rather than a package: the app needs about twenty glyphs, and shipping
 * a whole icon library for that is weight for nothing. Every one inherits
 * `currentColor`, so an icon is always the colour of the text it labels.
 *
 * Decorative by default (`aria-hidden`). An icon that carries meaning on its
 * own takes a `title`, which turns it into an image with an accessible name.
 */

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  /** Set only when the icon is the sole label for a control. */
  title?: string;
}

function Icon({ size = 16, title, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13h7V3H3zM14 21h7V11h-7zM3 21h7v-5H3zM14 8h7V3h-7z" />
  </Icon>
);

export const IconWishlist = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h10" />
    <path d="M17 15v6M14 18h6" />
  </Icon>
);

export const IconGoal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v18M3 12h18" />
    <path d="M12 4.5 19.5 12 12 19.5 4.5 12z" />
  </Icon>
);

export const IconExpenses = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5h18v14H3z" />
    <path d="M3 9h18M8 13h8" />
  </Icon>
);

export const IconSpending = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const IconLoan = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7h18v10H3z" />
    <path d="M7 12h2M15 12h2" />
  </Icon>
);

export const IconCard = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 6h20v12H2z" />
    <path d="M2 10h20M6 15h4" />
  </Icon>
);

export const IconReview = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 3h16v18H4z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <path d="M9 5v4M16 10v4M7 15v4" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 12 5.5 5.5L20 7" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5l14 14M19 5 5 19" />
  </Icon>
);

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);

export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const IconArrowUpRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
  </Icon>
);

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L20 8l-4-4L4 16z" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 9v5M12 17h.01" />
  </Icon>
);

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);

export const IconTransfer = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h13M13 4l4 4-4 4" />
    <path d="M20 16H7M11 12l-4 4 4 4" />
  </Icon>
);

export const IconSignOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4H4v16h6" />
    <path d="M14 12h8M18 8l4 4-4 4" />
  </Icon>
);

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
  </Icon>
);

export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" />
  </Icon>
);

export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Icon>
);

/* The guide marker: the glyph alone. Whatever it sits in is the box — drawing
   its own would put a square inside a square. The dot is set a touch heavier
   than the stem, or it disappears at 12px. */
export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 10.5v7" />
    <path d="M12 6.5h.01" strokeWidth={2} />
  </Icon>
);

/* A note, square-cornered like everything else, with the engraved centre. */
export const IconNote = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 6h20v12H2z" />
    <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
    <path d="M5.5 9v6M18.5 9v6" />
  </Icon>
);
