import Header from "./Header";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import CrispChat from "./CrispChat";

const Layout = ({
  children,
  hideFooter = false,
}: {
  children: React.ReactNode;
  /** Tenant skins that include a `footer.*` block render their own footer
   *  and pass hideFooter to suppress the global Footer. */
  hideFooter?: boolean;
}) => {
  // Platform chrome only. Tenant-branded chrome is composed via the skin system.
  return (
    <div className="min-h-screen flex flex-col scroll-smooth">
      <Header />
      <main className="flex-1 basis-auto">{children}</main>
      {!hideFooter && <Footer />}
      <BackToTop />
      <CrispChat />
    </div>
  );
};

export default Layout;
