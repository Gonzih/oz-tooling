#!/usr/bin/env node
/**
 * @gonzih/oz-calc — OZ Tax Benefit Calculator MCP Server
 *
 * Calculates Opportunity Zone tax benefits for OZ 1.0 and OZ 2.0 (OBBBA),
 * including QOF and QROF scenarios.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_FED_RATE = 0.238; // 23.8% federal LTCG + NIIT

/**
 * Calculate OZ tax benefits for a given scenario.
 *
 * OZ 2.0 Standard QOF:
 *   - 10% basis step-up at ≥5 years
 *   - Full appreciation exclusion at ≥10 years
 *   - FMV step-up basis at 30 years
 *
 * OZ 2.0 QROF (rural, pop <50k):
 *   - 30% basis step-up at ≥5 years
 *   - Full appreciation exclusion at ≥10 years
 *
 * OZ 1.0 (expires Jan 1, 2027):
 *   - Deferred gain recognized Dec 31, 2026
 *   - 10% step-up at 5yr, 15% at 7yr (7yr effectively dead)
 *   - Full exclusion at 10yr
 */
function calcOzBenefit(
  gainAmount: number,
  holdYears: number,
  isQrof: boolean,
  ozVersion: "1.0" | "2.0",
  taxRate: number,
): {
  deferred_tax: number;
  step_up_benefit: number;
  exclusion_benefit: number;
  total_benefit: number;
  net_effective_rate: number;
  original_tax_without_oz: number;
  tax_with_oz: number;
  notes: string[];
} {
  const originalTax = gainAmount * taxRate;
  const notes: string[] = [];

  if (ozVersion === "1.0") {
    // OZ 1.0: deferred gain recognized Dec 31, 2026
    const deferralYears = Math.max(0, 2026 - new Date().getFullYear());
    const deferredTaxValue = originalTax * (1 - Math.pow(1 / (1 + 0.05), deferralYears)); // rough TVM benefit

    let stepUpPct = 0;
    if (holdYears >= 7) {
      stepUpPct = 0.15;
      notes.push("7-year step-up (15%) is functionally dead — cannot reach 7yr before 2026 deadline if investing now");
    } else if (holdYears >= 5) {
      stepUpPct = 0.10;
      notes.push("10% basis step-up at 5 years applied");
    }

    const stepUpBenefit = gainAmount * stepUpPct * taxRate;
    const exclusionBenefit = holdYears >= 10 ? gainAmount * taxRate : 0;
    if (holdYears >= 10) notes.push("Full appreciation exclusion at 10 years applied");
    notes.push("OZ 1.0: deferred gain must be recognized by Dec 31, 2026");

    const totalBenefit = deferredTaxValue + stepUpBenefit + exclusionBenefit;
    const taxWithOz = Math.max(0, originalTax - stepUpBenefit - exclusionBenefit);

    return {
      deferred_tax: Math.round(deferredTaxValue * 100) / 100,
      step_up_benefit: Math.round(stepUpBenefit * 100) / 100,
      exclusion_benefit: Math.round(exclusionBenefit * 100) / 100,
      total_benefit: Math.round(totalBenefit * 100) / 100,
      net_effective_rate: Math.round((taxWithOz / gainAmount) * 10000) / 100,
      original_tax_without_oz: Math.round(originalTax * 100) / 100,
      tax_with_oz: Math.round(taxWithOz * 100) / 100,
      notes,
    };
  } else {
    // OZ 2.0
    const stepUpPct = isQrof && holdYears >= 5 ? 0.30 : holdYears >= 5 ? 0.10 : 0;
    if (stepUpPct > 0) {
      notes.push(`${stepUpPct * 100}% basis step-up at ≥5 years (${isQrof ? "QROF" : "standard QOF"})`);
    }

    const stepUpBenefit = gainAmount * stepUpPct * taxRate;
    const exclusionBenefit = holdYears >= 10 ? gainAmount * taxRate : 0;
    if (holdYears >= 10) notes.push("Full appreciation exclusion at ≥10 years applied");
    if (holdYears >= 30) notes.push("FMV step-up basis applies at 30 years");
    if (isQrof) notes.push("QROF: rural zone (pop <50k) — 30% step-up, 50% property reinvestment threshold");

    // OZ 2.0: gain deferred until disposition (no hard 2026 deadline)
    notes.push("OZ 2.0 effective Jan 1, 2027 — no 2026 recognition deadline");

    // Deferred tax benefit = time value of money on deferral
    // Approximate: investor earns ~5% on deferred tax for hold period
    const deferredTaxBenefit = originalTax * (1 - Math.pow(1 / (1 + 0.05), holdYears));

    const totalBenefit = deferredTaxBenefit + stepUpBenefit + exclusionBenefit;
    const taxWithOz = Math.max(0, originalTax - stepUpBenefit - exclusionBenefit);

    return {
      deferred_tax: Math.round(deferredTaxBenefit * 100) / 100,
      step_up_benefit: Math.round(stepUpBenefit * 100) / 100,
      exclusion_benefit: Math.round(exclusionBenefit * 100) / 100,
      total_benefit: Math.round(totalBenefit * 100) / 100,
      net_effective_rate: Math.round((taxWithOz / gainAmount) * 10000) / 100,
      original_tax_without_oz: Math.round(originalTax * 100) / 100,
      tax_with_oz: Math.round(taxWithOz * 100) / 100,
      notes,
    };
  }
}

const server = new McpServer({
  name: "oz-calc",
  version: "1.0.0",
});

server.tool(
  "calculate_oz_benefit",
  "Calculate Opportunity Zone tax benefits for a specific investment scenario",
  {
    gain_amount: z.number().positive().describe("Capital gain amount in USD"),
    investment_date: z.string().optional().describe("Investment date (YYYY-MM-DD). Defaults to today."),
    hold_years: z.number().int().min(0).max(40).describe("Planned hold period in years"),
    is_qrof: z.boolean().default(false).describe("True if investing in a Qualified Rural Opportunity Fund (QROF)"),
    oz_version: z.enum(["1.0", "2.0"]).default("2.0").describe("OZ version: 1.0 (current, expires) or 2.0 (OBBBA, effective Jan 1 2027)"),
    tax_rate: z.number().min(0).max(1).default(DEFAULT_FED_RATE).describe("Marginal tax rate on capital gains (default 0.238 = 23.8% federal LTCG + NIIT)"),
  },
  async ({ gain_amount, hold_years, is_qrof, oz_version, tax_rate }) => {
    const result = calcOzBenefit(gain_amount, hold_years, is_qrof, oz_version, tax_rate);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "compare_oz_vs_no_oz",
  "Side-by-side comparison of OZ investment vs. paying tax immediately",
  {
    gain_amount: z.number().positive().describe("Capital gain amount in USD"),
    marginal_rate: z.number().min(0).max(1).default(DEFAULT_FED_RATE).describe("Marginal tax rate (default 0.238)"),
    hold_years: z.number().int().min(0).max(40).describe("Hold period in years"),
    is_qrof: z.boolean().default(false).describe("True if QROF scenario"),
    assumed_annual_return: z.number().min(0).max(1).default(0.08).describe("Assumed annual return on OZ investment (default 0.08 = 8%)"),
  },
  async ({ gain_amount, marginal_rate, hold_years, is_qrof, assumed_annual_return }) => {
    // No OZ: pay tax now, invest remainder
    const taxNow = gain_amount * marginal_rate;
    const afterTaxInvested = gain_amount - taxNow;
    const noOzFinalValue = afterTaxInvested * Math.pow(1 + assumed_annual_return, hold_years);

    // OZ 2.0: invest full gain, tax deferred until disposition
    const ozCalc = calcOzBenefit(gain_amount, hold_years, is_qrof, "2.0", marginal_rate);
    const ozFinalValueBeforeTax = gain_amount * Math.pow(1 + assumed_annual_return, hold_years);
    const ozTaxAtExit = hold_years >= 10 ? 0 : (gain_amount - gain_amount * (is_qrof && hold_years >= 5 ? 0.30 : hold_years >= 5 ? 0.10 : 0)) * marginal_rate;
    const ozFinalValue = ozFinalValueBeforeTax - ozTaxAtExit;

    const comparison = {
      gain_amount,
      hold_years,
      tax_rate: marginal_rate,
      is_qrof,
      assumed_annual_return,
      scenario_no_oz: {
        tax_paid_upfront: Math.round(taxNow * 100) / 100,
        amount_invested: Math.round(afterTaxInvested * 100) / 100,
        final_value: Math.round(noOzFinalValue * 100) / 100,
        total_tax: Math.round(taxNow * 100) / 100,
      },
      scenario_oz_2_0: {
        tax_paid_upfront: 0,
        amount_invested: gain_amount,
        final_value_before_tax: Math.round(ozFinalValueBeforeTax * 100) / 100,
        tax_at_exit: Math.round(ozTaxAtExit * 100) / 100,
        final_value_after_tax: Math.round(ozFinalValue * 100) / 100,
        step_up_benefit: ozCalc.step_up_benefit,
        exclusion_benefit: ozCalc.exclusion_benefit,
      },
      oz_advantage: Math.round((ozFinalValue - noOzFinalValue) * 100) / 100,
      oz_advantage_pct: Math.round(((ozFinalValue - noOzFinalValue) / noOzFinalValue) * 10000) / 100,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
    };
  },
);

server.tool(
  "check_180_day_window",
  "Check if a capital gain is still within the 180-day OZ investment window",
  {
    gain_recognition_date: z.string().describe("Date capital gain was recognized (YYYY-MM-DD)"),
  },
  async ({ gain_recognition_date }) => {
    const gainDate = new Date(gain_recognition_date);
    const deadline = new Date(gainDate);
    deadline.setDate(deadline.getDate() + 180);

    const today = new Date();
    const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = daysRemaining < 0;

    const oz1Applicable = gainDate < new Date("2027-01-01");
    const oz2Applicable = gainDate >= new Date("2027-01-01") || gainDate >= new Date("2026-01-01"); // gains in 2026 may use oz2 if elected

    const result = {
      gain_recognition_date,
      investment_deadline: deadline.toISOString().split("T")[0],
      days_remaining: daysRemaining,
      is_expired: isExpired,
      oz1_applicable: oz1Applicable,
      oz2_applicable: oz2Applicable,
      urgency: isExpired ? "EXPIRED" : daysRemaining <= 30 ? "CRITICAL" : daysRemaining <= 60 ? "URGENT" : "OK",
      notes: [
        oz1Applicable && !isExpired
          ? "OZ 1.0: must invest in designated QOF within 180 days. Gain recognized Dec 31, 2026."
          : "",
        oz2Applicable
          ? "OZ 2.0 (effective Jan 1, 2027): same 180-day window applies"
          : "",
        isExpired ? "Window has expired. Cannot defer this gain into OZ." : "",
      ].filter(Boolean),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "oz1_vs_oz2",
  "Compare OZ 1.0 and OZ 2.0 outcomes for a specific investment",
  {
    gain_amount: z.number().positive().describe("Capital gain amount in USD"),
    investment_year: z.number().int().describe("Year of OZ investment (e.g. 2026 for OZ 1.0, 2027+ for OZ 2.0)"),
    hold_years: z.number().int().min(1).max(40).describe("Planned hold period in years"),
    tax_rate: z.number().min(0).max(1).default(DEFAULT_FED_RATE).describe("Marginal capital gains tax rate"),
  },
  async ({ gain_amount, investment_year, hold_years, tax_rate }) => {
    const oz1 = investment_year <= 2026
      ? calcOzBenefit(gain_amount, hold_years, false, "1.0", tax_rate)
      : { deferred_tax: 0, step_up_benefit: 0, exclusion_benefit: 0, total_benefit: 0, net_effective_rate: tax_rate * 100, original_tax_without_oz: gain_amount * tax_rate, tax_with_oz: gain_amount * tax_rate, notes: ["OZ 1.0 not available for post-2026 investments"] };

    const oz2 = calcOzBenefit(gain_amount, hold_years, false, "2.0", tax_rate);
    const oz2Qrof = calcOzBenefit(gain_amount, hold_years, true, "2.0", tax_rate);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            gain_amount,
            investment_year,
            hold_years,
            tax_rate,
            oz_1_0: oz1,
            oz_2_0_standard_qof: oz2,
            oz_2_0_qrof: oz2Qrof,
            recommendation: investment_year <= 2026
              ? hold_years >= 10
                ? "OZ 1.0 and OZ 2.0 both offer full exclusion at 10yr. OZ 1.0 has hard Dec 31 2026 deadline for gain recognition."
                : "OZ 1.0 deferred gain triggers Dec 31 2026 — factor this into tax planning."
              : "OZ 2.0 applies — no hard recognition deadline. QROF gives 30% step-up vs 10% standard.",
          }, null, 2),
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("oz-calc MCP server running on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
