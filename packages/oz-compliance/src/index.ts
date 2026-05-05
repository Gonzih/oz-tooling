#!/usr/bin/env node
/**
 * @gonzih/oz-compliance — QOF Compliance Tracking MCP Server
 *
 * Tools for Qualified Opportunity Fund (QOF) compliance under OZ 2.0 (OBBBA):
 *   - 90% asset test
 *   - QOZB eligibility
 *   - Substantial improvement rule
 *   - Reporting requirements (IRC §§6039K, 6039L)
 *   - Penalty exposure
 *   - Working capital safe harbor
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "oz-compliance",
  version: "1.0.0",
});

server.tool(
  "check_90pct_asset_test",
  "Check whether a QOF meets the 90% asset test (≥90% of assets must be QOZP — Qualified OZ Property)",
  {
    total_assets: z.number().positive().describe("Total QOF assets in USD"),
    qozp_assets: z.number().min(0).describe("Assets qualifying as QOZP (Qualified OZ Property) in USD"),
    measurement_date: z.string().optional().describe("Measurement date (YYYY-MM-DD). Defaults to today."),
  },
  async ({ total_assets, qozp_assets, measurement_date }) => {
    const date = measurement_date || new Date().toISOString().split("T")[0];
    const percentage = (qozp_assets / total_assets) * 100;
    const passes = percentage >= 90;
    const shortfall = passes ? 0 : Math.ceil((0.90 * total_assets - qozp_assets) * 100) / 100;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            measurement_date: date,
            total_assets,
            qozp_assets,
            qozp_percentage: Math.round(percentage * 100) / 100,
            passes_90pct_test: passes,
            shortfall_to_pass: shortfall,
            required_qozp: Math.ceil(0.90 * total_assets * 100) / 100,
            status: passes ? "COMPLIANT" : "NON-COMPLIANT",
            notes: [
              passes
                ? "90% asset test satisfied. Maintain compliance at each semi-annual testing date."
                : `Shortfall: need $${shortfall.toLocaleString()} more QOZP to meet 90% threshold.`,
              "90% test measured semi-annually (6-month and 12-month of tax year)",
              "Penalty for failing test: 5% of amount by which QOF falls short × applicable tax rate",
              "New investment grace period: 6 months to deploy fresh capital into QOZP",
            ],
          }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "check_qozb_eligibility",
  "Check whether a business qualifies as a QOZB (Qualified Opportunity Zone Business)",
  {
    gross_income_in_oz_pct: z.number().min(0).max(100).describe("Percentage of gross income derived from active conduct in OZ"),
    tangible_property_in_oz_pct: z.number().min(0).max(100).describe("Percentage of tangible property located in OZ"),
    nonqualified_financial_pct: z.number().min(0).max(100).describe("Percentage of assets that are nonqualified financial property (must be <5%)"),
    sin_business: z.boolean().default(false).describe("True if business is a sin business (golf courses, country clubs, massage parlors, hot tub facilities, suntan facilities, racetracks, casinos, liquor stores)"),
  },
  async ({ gross_income_in_oz_pct, tangible_property_in_oz_pct, nonqualified_financial_pct, sin_business }) => {
    const criteria = {
      gross_income_50pct: {
        label: "≥50% gross income from active OZ business",
        required: 50,
        actual: gross_income_in_oz_pct,
        passes: gross_income_in_oz_pct >= 50,
      },
      tangible_property_70pct: {
        label: "≥70% tangible property in OZ",
        required: 70,
        actual: tangible_property_in_oz_pct,
        passes: tangible_property_in_oz_pct >= 70,
      },
      nonqualified_financial_under5: {
        label: "<5% nonqualified financial property",
        required: 5,
        actual: nonqualified_financial_pct,
        passes: nonqualified_financial_pct < 5,
      },
      not_sin_business: {
        label: "Not a prohibited sin business",
        passes: !sin_business,
      },
    };

    const failingCriteria = Object.entries(criteria)
      .filter(([, c]) => !c.passes)
      .map(([key]) => key);

    const eligible = failingCriteria.length === 0;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            qozb_eligible: eligible,
            status: eligible ? "ELIGIBLE" : "NOT ELIGIBLE",
            criteria_results: criteria,
            failing_criteria: failingCriteria,
            notes: [
              eligible
                ? "Business qualifies as QOZB. QOF equity investment will count as QOZP."
                : `Fix failing criteria to qualify: ${failingCriteria.join(", ")}`,
              "QOZB must maintain eligibility throughout hold period",
              "Working capital safe harbor available for startup businesses (31-month deployment plan)",
              "Original use or substantial improvement required for tangible property",
            ],
          }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "check_substantial_improvement",
  "Check whether property meets the substantial improvement requirement for QOZP",
  {
    acquisition_cost: z.number().positive().describe("Property acquisition cost in USD"),
    improvements_made: z.number().min(0).describe("Amount of improvements made so far in USD"),
    months_elapsed: z.number().int().min(0).describe("Months elapsed since acquisition"),
    total_months_allowed: z.number().int().min(1).default(30).describe("Total months allowed for improvement (default 30)"),
  },
  async ({ acquisition_cost, improvements_made, months_elapsed, total_months_allowed }) => {
    // Substantial improvement: must improve by > acquisition cost within period
    const required_improvements = acquisition_cost; // must exceed original cost
    const meets_rule = improvements_made > required_improvements;
    const remaining_budget = Math.max(0, required_improvements - improvements_made + 1);
    const deadline_months = Math.max(0, total_months_allowed - months_elapsed);
    const pace_needed = deadline_months > 0 ? Math.ceil(remaining_budget / deadline_months) : null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            acquisition_cost,
            improvements_made,
            required_improvements: required_improvements,
            meets_substantial_improvement_rule: meets_rule,
            remaining_to_invest: meets_rule ? 0 : remaining_budget,
            months_elapsed,
            months_remaining: deadline_months,
            monthly_pace_needed: pace_needed,
            completion_pct: Math.min(100, Math.round((improvements_made / required_improvements) * 10000) / 100),
            status: meets_rule
              ? "MEETS SUBSTANTIAL IMPROVEMENT RULE"
              : deadline_months > 0
                ? "IN PROGRESS"
                : "FAILED — improvement period expired",
            notes: [
              "Substantial improvement: improvements must exceed original acquisition cost of building",
              "Land value is excluded from the improvement calculation",
              "30-month period begins when property is acquired by QOF/QOZB",
              "Original use property (new construction) is exempt from this requirement",
            ],
          }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "get_reporting_requirements",
  "Get OZ 2.0 annual reporting requirements under IRC §§6039K and 6039L",
  {
    fund_size_usd: z.number().positive().describe("Total QOF assets in USD"),
  },
  async ({ fund_size_usd }) => {
    const isLarge = fund_size_usd > 10_000_000;
    const perReturnPenalty = isLarge ? 50_000 : 10_000;

    const annualItems = [
      "Total QOF assets (fair market value)",
      "Fair market value of each qualified opportunity zone property",
      "Total amount invested in each QOZB",
      "Aggregate employee count across all QOZBs",
      "Total investor dispositions during the year",
      "Investor gain deferrals (gross amounts by investor class)",
      "Dates of investment and hold periods by investor",
    ];

    const forms = [
      "Form 8997 (investor level — gain deferrals and inclusions)",
      "Form 8996 (QOF annual certification and 90% asset test)",
      "New IRC §6039K/6039L annual return (OZ 2.0 — final forms TBD by IRS)",
    ];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            fund_size_usd,
            fund_tier: isLarge ? "Large Fund (>$10M)" : "Standard Fund (≤$10M)",
            filing_deadline: "Same as QOF tax return due date (Form 1065/1120 + extensions)",
            annual_reporting_items: annualItems,
            forms_required: forms,
            per_return_penalty_max: perReturnPenalty,
            notes: [
              "OZ 2.0 reporting requirements under IRC §§6039K and 6039L (OBBBA)",
              "Enhanced penalties for willful noncompliance — consult tax counsel",
              "Final IRS forms for OZ 2.0 reporting not yet published as of 2026",
              "OZ 1.0 Form 8996 remains in effect through OZ 1.0 fund wind-down",
              "State-level reporting may also apply — check state QOF rules",
            ],
          }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "calculate_penalty_exposure",
  "Calculate maximum penalty exposure for QOF reporting failures",
  {
    fund_size_usd: z.number().positive().describe("Total QOF assets in USD"),
    returns_count: z.number().int().min(1).describe("Number of investor returns that failed to report"),
    willful: z.boolean().default(false).describe("True if noncompliance was willful (enhanced penalties apply)"),
  },
  async ({ fund_size_usd, returns_count, willful }) => {
    const isLarge = fund_size_usd > 10_000_000;
    const basePerReturn = isLarge ? 50_000 : 10_000;

    // Willful: IRC §6721/6722 enhanced — up to $630 per return standard (2024 indexed)
    // But OZ-specific: OBBBA sets higher OZ-specific caps
    const perReturnPenalty = willful ? basePerReturn * 2 : basePerReturn;
    const maxPenalty = perReturnPenalty * returns_count;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            fund_size_usd,
            fund_tier: isLarge ? "Large Fund (>$10M)" : "Standard Fund (≤$10M)",
            returns_count,
            willful,
            per_return_penalty: perReturnPenalty,
            max_total_penalty: maxPenalty,
            penalty_basis: isLarge
              ? "$50,000/return base (funds >$10M) under OBBBA"
              : "$10,000/return base under OBBBA",
            willful_multiplier: willful ? "2x (willful noncompliance)" : "1x (standard)",
            notes: [
              "Penalty amounts based on OBBBA (One Big Beautiful Bill Act) OZ 2.0 provisions",
              "Actual penalty may be reduced by reasonable cause defense",
              "IRS has discretion to abate first-time penalties",
              "Enhanced penalties for willful noncompliance — consult tax counsel immediately",
              "Corrective filings may reduce exposure — file amended returns promptly",
            ],
          }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "check_working_capital_safe_harbor",
  "Check whether a business qualifies for the working capital safe harbor (31-month deployment rule)",
  {
    cash_amount: z.number().min(0).describe("Cash/cash equivalents held by QOZB in USD"),
    written_schedule_exists: z.boolean().describe("True if a written deployment schedule exists"),
    deployment_plan_exists: z.boolean().describe("True if a written plan for deployment of capital into qualified property exists"),
    months_held: z.number().int().min(0).default(0).describe("Months capital has been held (must be ≤31 for safe harbor)"),
  },
  async ({ cash_amount, written_schedule_exists, deployment_plan_exists, months_held }) => {
    const withinTimeLimit = months_held <= 31;
    const qualifies = written_schedule_exists && deployment_plan_exists && withinTimeLimit;
    const monthsRemaining = Math.max(0, 31 - months_held);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            cash_amount,
            written_schedule_exists,
            deployment_plan_exists,
            months_held,
            months_remaining: monthsRemaining,
            within_31_month_limit: withinTimeLimit,
            qualifies_for_safe_harbor: qualifies,
            status: qualifies ? "SAFE HARBOR APPLIES" : "SAFE HARBOR DOES NOT APPLY",
            failing_requirements: [
              !written_schedule_exists ? "Missing: written schedule for capital use" : null,
              !deployment_plan_exists ? "Missing: written plan for deployment into qualified property" : null,
              !withinTimeLimit ? `Exceeded: 31-month limit (${months_held} months held)` : null,
            ].filter(Boolean),
            notes: [
              "Working capital safe harbor: cash held for ≤31 months per written plan does not count against nonqualified financial property limit",
              "Must have written schedule AND written plan for use of capital",
              "Capital must actually be deployed consistent with the plan",
              "Reasonable cause exceptions available for deployment delays due to government action",
              "Applies only to QOZB level (not QOF level)",
            ],
          }, null, 2),
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("oz-compliance MCP server running on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
