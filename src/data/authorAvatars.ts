// Author avatars now use the site's logo/favicon instead of AI-generated photos.
// This module provides a helper to get initials for fallback display.

export const getAuthorAvatar = (_name: string): string | undefined => {
  // No longer returning static AI-generated author photos.
  // Blog components should use the site icon (from useSiteBranding) as author avatar.
  return undefined;
};

export const getAuthorInitials = (name: string): string => {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};
