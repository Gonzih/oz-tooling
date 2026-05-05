# OZ Tooling — Opportunity Zone MCP Servers

A monorepo of four Model Context Protocol (MCP) servers for Opportunity Zone (OZ) tax analysis, compliance, and planning — covering both OZ 1.0 (current) and OZ 2.0 (One Big Beautiful Bill Act, effective Jan 1, 2027).

---

## What Are OZ MCPs?

These packages expose Opportunity Zone domain knowledge as MCP tool servers. An AI agent (Claude, GPT-4, or any MCP-compatible client) can call these tools to answer real tax and compliance questions without hallucinating:

- **Exact tax math**: step-up percentages, exclusion thresholds, deferral timelines
- **Zone lookups**: census tract eligibility, QROF rural classification, state lists
- **Compliance checks**: 90% asset test, QOZB criteria, substantial improvement rule
- **Deadline tracking**: 180-day windows, Dec 31 2026 OZ 1.0 cutoff, July 2026 nomination window

> **Data freshness warning**: Embedded OZ 1.0 zone data is a representative subset of IRS Notice 2018-48. OZ 2.0 zone designations are not final pending governor nominations (opening July 1, 2026). Always verify with:
> - IRS OZ guidance: https://www.irs.gov/credits-deductions/opportunity-zones
> - HUD OZ mapping: https://hudgis-hud.opendata.arcgis.com/
> - IRS Notice 2018-48: https://www.irs.gov/pub/irs-drop/n-18-48.pdf

---

## The 4 Packages

| Package | Use Case | Key Tools |
|---------|----------|-----------|
| [`@gonzih/oz-calc`](packages/oz-calc) | Tax benefit calculations | `calculate_oz_benefit`, `compare_oz_vs_no_oz`, `check_180_day_window`, `oz1_vs_oz2` |
| [`@gonzih/oz-zones`](packages/oz-zones) | Zone eligibility & tract lookup | `lookup_zone`, `check_qrof_eligible`, `get_state_zones`, `search_zones_by_county`, `get_oz_timeline` |
| [`@gonzih/oz-compliance`](packages/oz-compliance) | QOF compliance tracking | `check_90pct_asset_test`, `check_qozb_eligibility`, `check_substantial_improvement`, `get_reporting_requirements`, `calculate_penalty_exposure`, `check_working_capital_safe_harbor` |
| [`@gonzih/oz-timeline`](packages/oz-timeline) | Deadlines & investment windows | `get_all_deadlines`, `check_investment_window`, `days_until_oz2`, `get_nomination_schedule`, `oz1_deadline_check` |

---

## Recommended Stack Combinations

### Individual Investor / Family Office
Realized a capital gain and evaluating OZ:

```
oz-calc + oz-timeline
```

- `check_180_day_window` → am I still in the window?
- `calculate_oz_benefit` → how much do I save at 10yr hold?
- `compare_oz_vs_no_oz` → OZ vs paying tax and reinvesting normally
- `oz1_deadline_check` → urgency on OZ 1.0 vs wait for OZ 2.0

### QOF Builder / Fund Sponsor
Setting up a Qualified Opportunity Fund:

```
oz-zones + oz-compliance + oz-timeline
```

- `get_state_zones` → which tracts to target
- `check_qrof_eligible` → rural QROF premium available?
- `check_90pct_asset_test` → ongoing compliance
- `check_qozb_eligibility` → do portfolio companies qualify?
- `get_reporting_requirements` → what do I file and when?
- `get_nomination_schedule` → OZ 2.0 zone timing by state

### Tax Advisor / CPA
Advising QOF clients:

```
oz-calc + oz-compliance + oz-timeline
```

- `oz1_vs_oz2` → side-by-side for clients deciding timing
- `calculate_penalty_exposure` → risk assessment for non-filers
- `check_substantial_improvement` → property compliance status
- `check_working_capital_safe_harbor` → startup QOZB cash treatment
- `get_reporting_requirements` → filing checklist per fund size

### OZ Marketplace / PropTech Developer
Building deal sourcing or analytics products:

```
oz-zones + oz-calc + oz-timeline
```

- `lookup_zone` → enrich property listings with OZ status
- `check_qrof_eligible` → flag QROF premium zones in search
- `search_zones_by_county` → county-level deal sourcing
- `calculate_oz_benefit` → investor ROI estimates per listing
- `get_nomination_schedule` → upcoming OZ 2.0 zone changes

---

## Quick Start

### npx (no install required)

```bash
npx @gonzih/oz-calc
npx @gonzih/oz-zones
npx @gonzih/oz-compliance
npx @gonzih/oz-timeline
```

Each server runs on stdio and responds to MCP JSON-RPC.

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "oz-calc": {
      "command": "npx",
      "args": ["-y", "@gonzih/oz-calc"]
    },
    "oz-zones": {
      "command": "npx",
      "args": ["-y", "@gonzih/oz-zones"]
    },
    "oz-compliance": {
      "command": "npx",
      "args": ["-y", "@gonzih/oz-compliance"]
    },
    "oz-timeline": {
      "command": "npx",
      "args": ["-y", "@gonzih/oz-timeline"]
    }
  }
}
```

Windows path: `%APPDATA%\Claude\claude_desktop_config.json`

### Minimal stack (investor + timeline only)

```json
{
  "mcpServers": {
    "oz-calc": {
      "command": "npx",
      "args": ["-y", "@gonzih/oz-calc"]
    },
    "oz-timeline": {
      "command": "npx",
      "args": ["-y", "@gonzih/oz-timeline"]
    }
  }
}
```

### Example tool calls

```
// Check if $500k gain is still investable in OZ
check_180_day_window("2025-03-01")

// Model 10-year OZ 2.0 benefit on $1M gain
calculate_oz_benefit({
  gain_amount: 1000000,
  hold_years: 10,
  is_qrof: false,
  oz_version: "2.0"
})

// Check QROF rural premium on a specific tract
check_qrof_eligible("48507950100")

// Is a $5M QOF passing the 90% test?
check_90pct_asset_test({
  total_assets: 5000000,
  qozp_assets: 4400000
})
```

---

## OZ 2.0 Gap Analysis

What these MCPs cover and what's still missing:

| Area | Status | Notes |
|------|--------|-------|
| Federal tax math (OZ 1.0 + 2.0) | Covered | `oz-calc` |
| Census tract lookups | Partial | Representative dataset; full HUD API integration not built |
| QROF rural classification | Covered | `oz-zones` |
| 90% asset test | Covered | `oz-compliance` |
| QOZB eligibility | Covered | `oz-compliance` |
| Annual reporting requirements | Covered | `oz-compliance` |
| Penalty exposure | Covered | `oz-compliance` |
| Deadlines and windows | Covered | `oz-timeline` |
| **State-level OZ incentive stacking** | **Missing** | Many states offer additional OZ credits (e.g. PA, NY, CA). State tax stacking not modeled. |
| **Reg D / securities compliance** | **Missing** | QOF offerings are typically securities — accredited investor rules, Form D filing not covered |
| **Secondary market / transfer rules** | **Missing** | OZ transfer of interests, installment sales, §1231 gains treatment not modeled |
| **OBBBA passage confirmation** | **Missing** | OZ 2.0 provisions depend on OBBBA enactment. Bill must pass both chambers and be signed. |
| **State nomination outcomes** | **Missing** | OZ 2.0 designated tracts won't be known until after July 2026 nomination process |
| **International/treaty issues** | **Missing** | Foreign investors in QOFs face FIRPTA and treaty considerations not covered |
| **QOF fund structuring** | **Missing** | LLC vs partnership vs C-corp QOF structures, blocker entities, carry treatment |

### OBBBA Status Note

OZ 2.0 mechanics (30% QROF step-up, permanent program, §§6039K/6039L reporting) are based on the **One Big Beautiful Bill Act** as introduced/passed in the House as of early 2025. The bill must still pass the Senate and be signed into law. Verify current legislative status before advising clients.

---

## Development

```bash
git clone <repo>
cd oz-tooling/packages/oz-calc
npm install
npm run build
node dist/index.js  # runs MCP server on stdio
```

Each package is fully standalone — no shared workspace configuration required.

---

## License

MIT
