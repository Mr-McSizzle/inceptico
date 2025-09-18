
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText } from "lucide-react";

const financialMetrics = {
  mrr: {
    name: "Monthly Recurring Revenue",
    description: "Total predictable recurring income from all paying customers per month.",
    formula: "# of paying customers * ARPU per month",
  },
  arr: {
    name: "Annual Recurring Revenue",
    description: "Annualized version of MRR.",
    formula: "MRR * 12",
  },
  arpu: {
    name: "Average Revenue Per User",
    description: "Average monthly revenue generated per active customer.",
    formula: "Total Revenue in Period / Number of Active Customers in Period",
  },
  gross_margin: {
    name: "Gross Margin",
    description: "The percentage of revenue remaining after subtracting direct costs (Cost of Sales).",
    formula: "(Revenue - Cost of Sales) / Revenue",
  },
  revenue_churn_rate: {
    name: "Revenue Churn Rate",
    description: "The percentage of lost MRR over a specified period.",
    formula: "(Lost MRR During Period / Starting MRR) * 100%",
  },
  customer_churn_rate: {
    name: "Customer Churn Rate",
    description: "The percentage of lost customers over a specified period.",
    formula: "(# of Lost Customers / # of Customers at Start of Period) * 100%",
  },
  net_revenue_retention_nrr: {
    name: "Net Revenue Retention",
    description: "Measures recurring revenue retained from existing customers, including expansions, contractions, and churn.",
    formula: "((Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100%",
  },
  customer_lifetime_value_ltv: {
    name: "Customer Lifetime Value",
    description: "Total projected profit a customer will generate throughout their relationship.",
    formula: "(ARPU * Gross Margin) / Churn Rate",
  },
  customer_acquisition_cost_cac: {
    name: "Customer Acquisition Cost",
    description: "Total cost to acquire a new, paying customer.",
    formula: "Total Sales & Marketing Expenses / # of New Customers Acquired",
  },
  ltv_cac_ratio: {
    name: "LTV to CAC Ratio",
    description: "The relationship between the lifetime value of a customer and the cost to acquire them.",
    formula: "LTV / CAC",
  },
  cac_payback_period: {
    name: "CAC Payback Period",
    description: "Number of months to recoup customer acquisition costs through gross profit.",
    formula: "CAC / (ARPU * Gross Margin)",
  },
  operating_expenses: {
    name: "Operating Expenses",
    description: "Day-to-day costs of running the business, separate from Cost of Sales.",
    formula: "Sum of all non-COGS expenses (R&D, Sales & Marketing, G&A)",
  },
};

export function FormulasReference() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          SaaS Metrics Reference
        </CardTitle>
        <CardDescription>
          Key financial formulas and benchmarks used in the simulation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {Object.entries(financialMetrics).map(([key, metric]) => (
            <AccordionItem value={key} key={key}>
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                {metric.name}
              </AccordionTrigger>
              <AccordionContent className="px-2">
                <p className="text-xs text-muted-foreground mb-2">
                  {metric.description}
                </p>
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs font-mono text-foreground">
                    <span className="font-semibold">Formula:</span> {metric.formula}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

    