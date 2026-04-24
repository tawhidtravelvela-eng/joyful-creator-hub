import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import ProtectedAdminRoute from "@/components/auth/ProtectedAdminRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Loader2 } from "lucide-react";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";

// ── Eager-loaded (critical path) ──
import Index from "./pages/Index";
import Flights from "./pages/Flights";
import FlightDetail from "./pages/FlightDetail";
import Hotels from "./pages/Hotels";
import HotelDetail from "./pages/HotelDetail";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import TenantHome from "./pages/TenantHome";
import TenantVerticalRoute from "./pages/TenantVerticalRoute";

// ── Lazy-loaded (secondary pages) ──
const FlightBooking = lazy(() => import("./pages/FlightBooking"));
const HotelBooking = lazy(() => import("./pages/HotelBooking"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"));
const BookingPayment = lazy(() => import("./pages/BookingPayment"));
const ETicket = lazy(() => import("./pages/ETicket"));
const Tours = lazy(() => import("./pages/Tours"));
const Transfers = lazy(() => import("./pages/Transfers"));
const TourDetail = lazy(() => import("./pages/TourDetail"));
const TourBooking = lazy(() => import("./pages/TourBooking"));
const TourInquiry = lazy(() => import("./pages/TourInquiry"));
const ExperienceDetail = lazy(() => import("./pages/ExperienceDetail"));
const ExperienceBooking = lazy(() => import("./pages/ExperienceBooking"));
const RegisterCorporate = lazy(() => import("./pages/RegisterCorporate"));
const RegisterAgent = lazy(() => import("./pages/RegisterAgent"));
const DashboardRouter = lazy(() => import("./pages/DashboardRouter"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const AuthorPage = lazy(() => import("./pages/AuthorPage"));
const TripPlanner = lazy(() => import("./pages/TripPlanner"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const TestPayments = lazy(() => import("./pages/TestPayments"));

// ── Lazy-loaded admin pages ──
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminFlights = lazy(() => import("./pages/admin/AdminFlights"));
const AdminHotels = lazy(() => import("./pages/admin/AdminHotels"));
const AdminTours = lazy(() => import("./pages/admin/AdminTours"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminApiSettings = lazy(() => import("./pages/admin/AdminApiSettings"));
const AdminMarkups = lazy(() => import("./pages/admin/AdminMarkups"));
const AdminAirlineSettings = lazy(() => import("./pages/admin/AdminAirlineSettings"));
const AdminStudentBaggage = lazy(() => import("./pages/admin/AdminStudentBaggage"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminQueueDashboard = lazy(() => import("./pages/admin/AdminQueueDashboard"));
const AdminPopularRoutes = lazy(() => import("./pages/admin/AdminPopularRoutes"));
const AdminTerms = lazy(() => import("./pages/admin/AdminTerms"));
const AdminPrivacyPolicy = lazy(() => import("./pages/admin/AdminPrivacyPolicy"));
const AdminRefundPolicy = lazy(() => import("./pages/admin/AdminRefundPolicy"));
const AdminTicketRequests = lazy(() => import("./pages/admin/AdminTicketRequests"));
const AdminHomepage = lazy(() => import("./pages/admin/AdminHomepage"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminTenantApiSettings = lazy(() => import("./pages/admin/AdminTenantApiSettings"));
const AdminUserApprovals = lazy(() => import("./pages/admin/AdminUserApprovals"));
const AdminTenantPaymentSettings = lazy(() => import("./pages/admin/AdminTenantPaymentSettings"));
const AdminAccounting = lazy(() => import("./pages/admin/AdminAccounting"));
const AdminAiUsage = lazy(() => import("./pages/admin/AdminAiUsage"));
const AdminAiSettings = lazy(() => import("./pages/admin/AdminAiSettings"));
const AdminTripRequests = lazy(() => import("./pages/admin/AdminTripRequests"));
const AdminAffiliates = lazy(() => import("./pages/admin/AdminAffiliates"));
const AdminThemeSettings = lazy(() => import("./pages/admin/AdminThemeSettings"));
const AdminAppearance = lazy(() => import("./pages/admin/AdminAppearance"));
const AdminFeaturedItems = lazy(() => import("./pages/admin/AdminFeaturedItems"));
const AdminUtilityApis = lazy(() => import("./pages/admin/AdminUtilityApis"));
const AdminItineraryDebug = lazy(() => import("./pages/admin/AdminItineraryDebug"));
const AdminPipelineDebug = lazy(() => import("./pages/admin/AdminPipelineDebug"));
const AdminPlatformFeatures = lazy(() => import("./pages/admin/AdminPlatformFeatures"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const SubAffiliatePortal = lazy(() => import("./pages/SubAffiliatePortal"));
const FlightStatus = lazy(() => import("./pages/FlightStatus"));
const B2BFlightResults = lazy(() => import("./pages/B2BFlightResults"));
const Studio = lazy(() => import("./pages/Studio"));
const StudioSetup = lazy(() => import("./pages/StudioSetup"));
const TenantPage = lazy(() => import("./pages/TenantPage"));
const PartnerLanding = lazy(() => import("./pages/PartnerLanding"));

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedAdminRoute>{children}</ProtectedAdminRoute>
);

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const AppContent = () => {
  useThemeColors();
  useAffiliateTracking();
  return (
    <BrowserRouter>
      <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Tenant-aware homepage: renders skin/blocks on tenant domains,
              platform Index otherwise. */}
          <Route path="/" element={<TenantHome />} />
          {/* Tenant-defined custom pages, e.g. /p/about, /p/contact. */}
          <Route path="/p/:slug" element={<TenantPage />} />
          {/* Hybrid-skin partner landing page. Active only on tenant
              domains where the slug matches `tenants.b2b_landing_slug`
              (default "partners"). On the platform domain → 404. */}
          <Route path="/partners" element={<PartnerLanding slug="partners" />} />
          <Route
            path="/flights"
            element={<TenantVerticalRoute pageSlug="flights" fallback={<Flights />} />}
          />
          <Route path="/flights/:id" element={<FlightDetail />} />
          <Route
            path="/hotels"
            element={<TenantVerticalRoute pageSlug="hotels" fallback={<Hotels />} />}
          />
          <Route path="/hotels/:city/:slug" element={<HotelDetail />} />
          {/* Legacy fallback */}
          <Route path="/hotels/:id" element={<HotelDetail />} />
          <Route path="/auth" element={<Auth />} />

          {/* Lazy public routes */}
          <Route path="/flights/:id/book" element={<FlightBooking />} />
          <Route path="/hotels/:city/:slug/book" element={<HotelBooking />} />
          <Route path="/hotels/:id/book" element={<HotelBooking />} />
          <Route path="/booking/confirmation" element={<BookingConfirmation />} />
          <Route path="/booking/ticket/:id" element={<ETicket />} />
          <Route path="/booking/pay/:id" element={<BookingPayment />} />
          <Route
            path="/tours"
            element={<TenantVerticalRoute pageSlug="tours" fallback={<Tours />} />}
          />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/tours/:id" element={<TourDetail />} />
          <Route path="/tours/:destination/:slug" element={<ExperienceDetail />} />
          <Route path="/tours/:destination/:slug/book" element={<ExperienceBooking />} />
          {/* Legacy fallback for old URLs */}
          <Route path="/tours/experience/:productCode" element={<ExperienceDetail />} />
          <Route path="/tours/experience/:productCode/book" element={<ExperienceBooking />} />
          <Route path="/tours/:id/book" element={<TourBooking />} />
          <Route path="/tours/:id/inquiry" element={<TourInquiry />} />
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route
            path="/blog"
            element={<TenantVerticalRoute pageSlug="blog" fallback={<Blog />} />}
          />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/blog/author/:slug" element={<AuthorPage />} />
          <Route path="/register/corporate" element={<RegisterCorporate />} />
          <Route path="/register/agent" element={<RegisterAgent />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/trip-planner" element={<TripPlanner />} />
          <Route path="/test-payments" element={<TestPayments />} />
          <Route path="/affiliate" element={<AffiliateDashboard />} />
          <Route path="/affiliate-portal" element={<SubAffiliatePortal />} />
          <Route path="/flight-status" element={<FlightStatus />} />
          <Route path="/dashboard/flights/results" element={<B2BFlightResults />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/studio/setup" element={<StudioSetup />} />

          {/* Lazy admin routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/flights" element={<AdminRoute><AdminFlights /></AdminRoute>} />
          <Route path="/admin/hotels" element={<AdminRoute><AdminHotels /></AdminRoute>} />
          <Route path="/admin/tours" element={<AdminRoute><AdminTours /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/content" element={<AdminRoute><AdminContent /></AdminRoute>} />
          <Route path="/admin/api-settings" element={<AdminRoute><AdminApiSettings /></AdminRoute>} />
          <Route path="/admin/markups" element={<AdminRoute><AdminMarkups /></AdminRoute>} />
          <Route path="/admin/airline-settings" element={<AdminRoute><AdminAirlineSettings /></AdminRoute>} />
          <Route path="/admin/student-baggage" element={<AdminRoute><AdminStudentBaggage /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
          <Route path="/admin/blog" element={<AdminRoute><AdminBlog /></AdminRoute>} />
          <Route path="/admin/queues" element={<AdminRoute><AdminQueueDashboard /></AdminRoute>} />
          <Route path="/admin/popular-routes" element={<AdminRoute><AdminPopularRoutes /></AdminRoute>} />
          <Route path="/admin/terms" element={<AdminRoute><AdminTerms /></AdminRoute>} />
          <Route path="/admin/privacy-policy" element={<AdminRoute><AdminPrivacyPolicy /></AdminRoute>} />
          <Route path="/admin/refund-policy" element={<AdminRoute><AdminRefundPolicy /></AdminRoute>} />
          <Route path="/admin/ticket-requests" element={<AdminRoute><AdminTicketRequests /></AdminRoute>} />
          <Route path="/admin/homepage" element={<AdminRoute><AdminHomepage /></AdminRoute>} />
          <Route path="/admin/tenants" element={<AdminRoute><AdminTenants /></AdminRoute>} />
          <Route path="/admin/tenant-api" element={<AdminRoute><AdminTenantApiSettings /></AdminRoute>} />
          <Route path="/admin/user-approvals" element={<AdminRoute><AdminUserApprovals /></AdminRoute>} />
          <Route path="/admin/tenant-payment" element={<AdminRoute><AdminTenantPaymentSettings /></AdminRoute>} />
          <Route path="/admin/accounting" element={<AdminRoute><AdminAccounting /></AdminRoute>} />
          <Route path="/admin/ai-usage" element={<AdminRoute><AdminAiUsage /></AdminRoute>} />
          <Route path="/admin/ai-settings" element={<AdminRoute><AdminAiSettings /></AdminRoute>} />
          <Route path="/admin/trip-requests" element={<AdminRoute><AdminTripRequests /></AdminRoute>} />
          <Route path="/admin/affiliates" element={<AdminRoute><AdminAffiliates /></AdminRoute>} />
          <Route path="/admin/theme" element={<AdminRoute><AdminThemeSettings /></AdminRoute>} />
          <Route path="/admin/admin-appearance" element={<AdminRoute><AdminAppearance /></AdminRoute>} />
          <Route path="/admin/featured-items" element={<AdminRoute><AdminFeaturedItems /></AdminRoute>} />
          <Route path="/admin/utility-apis" element={<AdminRoute><AdminUtilityApis /></AdminRoute>} />
          <Route path="/admin/itinerary-debug" element={<AdminRoute><AdminItineraryDebug /></AdminRoute>} />
          <Route path="/admin/pipeline-debug" element={<AdminRoute><AdminPipelineDebug /></AdminRoute>} />
          <Route path="/admin/platform-features" element={<AdminRoute><AdminPlatformFeatures /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CurrencyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
      </CurrencyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
