export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: {
    bg: string;
    primary: string;
    accent: string;
    card: string;
    text: string;
  };
  colors: {
    background: string;
    foreground: string;
    primary: string;
    primary_foreground: string;
    secondary: string;
    secondary_foreground: string;
    accent: string;
    accent_foreground: string;
    muted: string;
    muted_foreground: string;
    destructive: string;
    card: string;
    card_foreground: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  radius: string; // e.g. "0.5rem", "1rem", "1.5rem"
}

export const themePresets: ThemePreset[] = [
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Cool ocean tones with crisp whites and refreshing blues. Clean, modern, and professional.",
    preview: { bg: "#f0f7ff", primary: "#1a73e8", accent: "#00bcd4", card: "#ffffff", text: "#1a2b3c" },
    colors: {
      background: "#f0f7ff",
      foreground: "#1a2b3c",
      primary: "#1a73e8",
      primary_foreground: "#ffffff",
      secondary: "#e3f0fc",
      secondary_foreground: "#1a4d8f",
      accent: "#00bcd4",
      accent_foreground: "#ffffff",
      muted: "#e8eef5",
      muted_foreground: "#5c7a99",
      destructive: "#d32f2f",
      card: "#ffffff",
      card_foreground: "#1a2b3c",
      border: "#c8ddf0",
    },
    fonts: { heading: "Poppins", body: "Inter" },
    radius: "0.75rem",
  },
  {
    id: "sunset-glow",
    name: "Sunset Glow",
    description: "Warm terracotta and golden hues that feel inviting, vibrant, and full of energy.",
    preview: { bg: "#fdf6f0", primary: "#d4572a", accent: "#e8a838", card: "#ffffff", text: "#3b2011" },
    colors: {
      background: "#fdf6f0",
      foreground: "#3b2011",
      primary: "#d4572a",
      primary_foreground: "#ffffff",
      secondary: "#fde8d8",
      secondary_foreground: "#8c3515",
      accent: "#e8a838",
      accent_foreground: "#3b2011",
      muted: "#f5ebe3",
      muted_foreground: "#8a6e5a",
      destructive: "#c62828",
      card: "#ffffff",
      card_foreground: "#3b2011",
      border: "#e8d5c4",
    },
    fonts: { heading: "Playfair Display", body: "Lato" },
    radius: "1rem",
  },
  {
    id: "forest-canopy",
    name: "Forest Canopy",
    description: "Rich emerald greens and earthy tones. Organic, trustworthy, and grounding.",
    preview: { bg: "#f4f8f4", primary: "#2e7d32", accent: "#8bc34a", card: "#ffffff", text: "#1b2e1b" },
    colors: {
      background: "#f4f8f4",
      foreground: "#1b2e1b",
      primary: "#2e7d32",
      primary_foreground: "#ffffff",
      secondary: "#e0f0e0",
      secondary_foreground: "#1b5e20",
      accent: "#8bc34a",
      accent_foreground: "#1b2e1b",
      muted: "#e8efe8",
      muted_foreground: "#5a7a5a",
      destructive: "#c62828",
      card: "#ffffff",
      card_foreground: "#1b2e1b",
      border: "#c4dcc4",
    },
    fonts: { heading: "Merriweather", body: "Source Sans 3" },
    radius: "0.5rem",
  },
  {
    id: "royal-luxe",
    name: "Royal Luxe",
    description: "Deep indigo and gold accents for a sophisticated, premium, and luxurious feel.",
    preview: { bg: "#f5f3fa", primary: "#4a148c", accent: "#ffc107", card: "#ffffff", text: "#1a0a33" },
    colors: {
      background: "#f5f3fa",
      foreground: "#1a0a33",
      primary: "#4a148c",
      primary_foreground: "#ffffff",
      secondary: "#ede7f6",
      secondary_foreground: "#311b72",
      accent: "#ffc107",
      accent_foreground: "#1a0a33",
      muted: "#ece8f3",
      muted_foreground: "#6a5a8a",
      destructive: "#c62828",
      card: "#ffffff",
      card_foreground: "#1a0a33",
      border: "#d1c4e9",
    },
    fonts: { heading: "Cormorant Garamond", body: "Nunito Sans" },
    radius: "1.25rem",
  },
  {
    id: "midnight-pro",
    name: "Midnight Pro",
    description: "Sleek dark mode with electric cyan highlights. Bold, modern, and cutting-edge.",
    preview: { bg: "#0f1923", primary: "#00e5ff", accent: "#ff4081", card: "#1a2733", text: "#e0eaf4" },
    colors: {
      background: "#0f1923",
      foreground: "#e0eaf4",
      primary: "#00e5ff",
      primary_foreground: "#0f1923",
      secondary: "#1a2733",
      secondary_foreground: "#b0c4d8",
      accent: "#ff4081",
      accent_foreground: "#ffffff",
      muted: "#1e2d3d",
      muted_foreground: "#7a93aa",
      destructive: "#ff1744",
      card: "#1a2733",
      card_foreground: "#e0eaf4",
      border: "#2a3d50",
    },
    fonts: { heading: "Space Grotesk", body: "DM Sans" },
    radius: "0.625rem",
  },
];

// Google Fonts import URL for all theme fonts
export function getThemeFontUrl(heading: string, body: string): string {
  const fonts = [heading, body]
    .filter((f, i, a) => a.indexOf(f) === i)
    .map((f) => f.replace(/ /g, "+") + ":wght@400;500;600;700")
    .join("&family=");
  return `https://fonts.googleapis.com/css2?family=${fonts}&display=swap`;
}
