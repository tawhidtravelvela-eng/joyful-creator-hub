import { useSiteBranding } from "@/hooks/useSiteBranding";
import { getAuthorInitials } from "@/data/authorAvatars";

interface AuthorAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-6 h-6 text-[8px]",
  md: "w-9 h-9 text-[11px]",
  lg: "w-11 h-11 text-xs",
};

const AuthorAvatar = ({ name, size = "md", className = "" }: AuthorAvatarProps) => {
  const { branding } = useSiteBranding();
  const iconUrl = branding.favicon_url || branding.logo_url;

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className={`${sizeMap[size]} rounded-full object-cover ring-2 ring-background shadow-lg shadow-primary/15 ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/15 ${className}`}>
      {getAuthorInitials(name)}
    </div>
  );
};

export default AuthorAvatar;
