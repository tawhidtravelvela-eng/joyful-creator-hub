import { B2BProvider } from "@/contexts/B2BContext";
import { B2BLayout } from "@/components/b2b/B2BLayout";
import { useLocation, useNavigate } from "react-router-dom";
import B2BFlightResultsView from "@/components/b2b/flights/B2BFlightResultsView";

const B2BFlightResultsContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = (location.state as any)?.ctx;
  return (
    <B2BFlightResultsView
      ctx={ctx}
      onModify={() => navigate("/dashboard?tab=search-book")}
    />
  );
};

const B2BFlightResults = () => (
  <B2BProvider>
    <B2BLayout>
      <B2BFlightResultsContent />
    </B2BLayout>
  </B2BProvider>
);

export default B2BFlightResults;
