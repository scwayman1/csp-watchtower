import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export const EducationPanel = () => {
  return (
    <Card className="p-4 h-fit sticky top-4">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">CSP Education</h3>
      </div>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="what-is-csp">
          <AccordionTrigger className="text-sm">
            What is a Cash-Secured Put?
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            A cash-secured put (CSP) is a short put option position where you hold enough cash to purchase 
            the underlying stock if assigned. You collect premium upfront and either keep it if the option 
            expires worthless, or buy shares at the strike price if assigned.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="key-metrics">
          <AccordionTrigger className="text-sm">
            Key Metrics Explained
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <div>
              <strong>Break-Even:</strong> Strike − Credit. The price at which you break even if assigned.
            </div>
            <div>
              <strong>Max Profit:</strong> Credit × 100 × Contracts. Maximum you can earn (keep premium).
            </div>
            <div>
              <strong>Capital Required:</strong> Strike × 100 × Contracts. Cash needed to secure the put.
            </div>
            <div>
              <strong>ROC:</strong> Max Profit / Capital Required. Return on capital as a percentage.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="risks">
          <AccordionTrigger className="text-sm">
            Risks to Consider
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-4 space-y-1">
              <li>Assignment if price ≤ strike at expiration</li>
              <li>Early assignment possible (American options)</li>
              <li>Opportunity cost if stock rallies significantly</li>
              <li>Capital tied up until expiration or closing</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="greeks">
          <AccordionTrigger className="text-sm">
            Greeks Simplified
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <div>
              <strong>Delta (Δ):</strong> Approximates assignment probability. Higher absolute delta = 
              higher chance of assignment.
            </div>
            <div>
              <strong>Theta (θ):</strong> Time decay per day. Positive for short puts—you profit from decay.
            </div>
            <div>
              <strong>Vega (ν):</strong> Sensitivity to implied volatility changes. Higher IV = higher premiums.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="best-practices">
          <AccordionTrigger className="text-sm">
            Best Practices
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-4 space-y-1">
              <li>Choose strikes 5-10% below current price for safety</li>
              <li>Target 30-45 DTE for optimal theta decay</li>
              <li>Look for ROC &gt; 1% per month</li>
              <li>Consider stocks you'd be happy to own</li>
              <li>Use stop losses or roll positions to manage risk</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};
