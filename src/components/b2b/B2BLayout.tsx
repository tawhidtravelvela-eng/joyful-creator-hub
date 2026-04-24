import { ReactNode } from "react";
import { B2BSidebar } from "./B2BSidebar";
import { B2BTopHeader } from "./B2BTopHeader";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";

interface B2BLayoutProps {
  children: ReactNode;
}

export const B2BLayout = ({ children }: B2BLayoutProps) => {
  // Auto-derived from the signed-in agent's logo and applied ONLY inside the
  // B2B dashboard subtree, so the rest of the app (auth pages, public site,
  // super-admin) keeps the platform palette.
  const { themeVars } = useBrandTheme();
  const { isHybrid } = useIsHybridSkin();

  return (
    <div
      className={`min-h-screen flex bg-background${isHybrid ? " hybrid-skin-active" : ""}`}
      style={themeVars ?? undefined}
    >
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[220px] flex-shrink-0 flex-col sticky top-0 h-screen overflow-y-auto">
        <B2BSidebar />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <B2BTopHeader />
        <main className="flex-1 px-5 py-5 lg:px-7 lg:py-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
