import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SubAffiliatePortal = () => {
  return (
    <Layout>
      <div className="container mx-auto py-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Sub-affiliate portal — rebuilding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The sub-affiliate program is being rebuilt on top of our new
              tenant skin platform. Existing top-level affiliate links continue
              to work and earn commission.
            </p>
            <p>
              You'll receive an email when the new portal is ready. In the
              meantime, please contact your tenant admin for any earnings
              questions.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SubAffiliatePortal;
