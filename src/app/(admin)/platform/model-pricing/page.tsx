import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_MODEL_PRICING } from "@/lib/ai/models";
import { createSupabaseServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

async function getPricing() {
  if (!hasSupabaseConfig()) return DEFAULT_MODEL_PRICING;
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("model_pricing").select("*").order("model_name");
  return data?.length ? data : DEFAULT_MODEL_PRICING;
}

export default async function ModelPricingPage() {
  const pricing = await getPricing();
  return (
    <>
      <PageHeader title="Model Pricing" description="Central pricing values used by the cost calculator." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Input / 1M</TableHead>
                <TableHead>Output / 1M</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.map((model) => (
                <TableRow key={model.model_name}>
                  <TableCell className="font-mono">{model.model_name}</TableCell>
                  <TableCell>${model.input_per_1m}</TableCell>
                  <TableCell>${model.output_per_1m}</TableCell>
                  <TableCell>{"active" in model ? String(model.active) : "true"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
