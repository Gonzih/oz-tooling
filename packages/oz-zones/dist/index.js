#!/usr/bin/env node
"use strict";
/**
 * @gonzih/oz-zones — OZ Zone Eligibility & Census Tract Lookup MCP Server
 *
 * Provides lookup of OZ 1.0 designated tracts and OZ 2.0 eligibility assessment.
 * Embedded dataset is representative; for production use query IRS/HUD APIs.
 *
 * Data sources:
 *   OZ 1.0: IRS Notice 2018-48 (8,764 designated tracts)
 *   OZ 2.0: OBBBA criteria — ≤70% state/metro median income, re-evaluated every 10 years
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const OZ_ZONES = {
    // California
    "06001402100": { state: "California", state_abbr: "CA", county: "Alameda", median_income_pct: 45, rural: false, population: 3200, oz1_designated: true },
    "06001402200": { state: "California", state_abbr: "CA", county: "Alameda", median_income_pct: 52, rural: false, population: 4100, oz1_designated: true },
    "06037206200": { state: "California", state_abbr: "CA", county: "Los Angeles", median_income_pct: 38, rural: false, population: 5800, oz1_designated: true },
    "06037206300": { state: "California", state_abbr: "CA", county: "Los Angeles", median_income_pct: 41, rural: false, population: 4200, oz1_designated: true },
    "06073008302": { state: "California", state_abbr: "CA", county: "San Diego", median_income_pct: 55, rural: false, population: 3900, oz1_designated: true },
    "06019000100": { state: "California", state_abbr: "CA", county: "Fresno", median_income_pct: 35, rural: false, population: 2800, oz1_designated: true },
    "06045001100": { state: "California", state_abbr: "CA", county: "Mendocino", median_income_pct: 62, rural: true, population: 1200, oz1_designated: true },
    // Texas
    "48113004400": { state: "Texas", state_abbr: "TX", county: "Dallas", median_income_pct: 48, rural: false, population: 3600, oz1_designated: true },
    "48201231100": { state: "Texas", state_abbr: "TX", county: "Harris", median_income_pct: 42, rural: false, population: 5200, oz1_designated: true },
    "48029170100": { state: "Texas", state_abbr: "TX", county: "Bexar", median_income_pct: 50, rural: false, population: 4800, oz1_designated: true },
    "48507950100": { state: "Texas", state_abbr: "TX", county: "Zavala", median_income_pct: 31, rural: true, population: 800, oz1_designated: true },
    // New York
    "36061010900": { state: "New York", state_abbr: "NY", county: "New York (Manhattan)", median_income_pct: 40, rural: false, population: 7200, oz1_designated: true },
    "36047052600": { state: "New York", state_abbr: "NY", county: "Kings (Brooklyn)", median_income_pct: 44, rural: false, population: 6800, oz1_designated: true },
    "36005030300": { state: "New York", state_abbr: "NY", county: "Bronx", median_income_pct: 33, rural: false, population: 8100, oz1_designated: true },
    "36019960600": { state: "New York", state_abbr: "NY", county: "Clinton", median_income_pct: 58, rural: true, population: 950, oz1_designated: true },
    // Florida
    "12031000200": { state: "Florida", state_abbr: "FL", county: "Duval", median_income_pct: 46, rural: false, population: 4300, oz1_designated: true },
    "12086001700": { state: "Florida", state_abbr: "FL", county: "Miami-Dade", median_income_pct: 39, rural: false, population: 5500, oz1_designated: true },
    "12003010100": { state: "Florida", state_abbr: "FL", county: "Alachua", median_income_pct: 54, rural: false, population: 3100, oz1_designated: true },
    "12027050100": { state: "Florida", state_abbr: "FL", county: "DeSoto", median_income_pct: 44, rural: true, population: 1100, oz1_designated: true },
    // Illinois
    "17031840300": { state: "Illinois", state_abbr: "IL", county: "Cook", median_income_pct: 37, rural: false, population: 6200, oz1_designated: true },
    "17031840600": { state: "Illinois", state_abbr: "IL", county: "Cook", median_income_pct: 41, rural: false, population: 5700, oz1_designated: true },
    "17201050200": { state: "Illinois", state_abbr: "IL", county: "Williamson", median_income_pct: 61, rural: true, population: 1400, oz1_designated: true },
    // Pennsylvania
    "42101009300": { state: "Pennsylvania", state_abbr: "PA", county: "Philadelphia", median_income_pct: 36, rural: false, population: 7800, oz1_designated: true },
    "42003562000": { state: "Pennsylvania", state_abbr: "PA", county: "Allegheny (Pittsburgh)", median_income_pct: 49, rural: false, population: 4100, oz1_designated: true },
    "42035960500": { state: "Pennsylvania", state_abbr: "PA", county: "Clinton", median_income_pct: 65, rural: true, population: 1050, oz1_designated: true },
    // Ohio
    "39035100200": { state: "Ohio", state_abbr: "OH", county: "Cuyahoga (Cleveland)", median_income_pct: 34, rural: false, population: 5900, oz1_designated: true },
    "39049003000": { state: "Ohio", state_abbr: "OH", county: "Franklin (Columbus)", median_income_pct: 47, rural: false, population: 4400, oz1_designated: true },
    "39019960600": { state: "Ohio", state_abbr: "OH", county: "Carroll", median_income_pct: 68, rural: true, population: 900, oz1_designated: true },
    // Georgia
    "13121010200": { state: "Georgia", state_abbr: "GA", county: "Fulton (Atlanta)", median_income_pct: 43, rural: false, population: 4600, oz1_designated: true },
    "13051010300": { state: "Georgia", state_abbr: "GA", county: "Chatham (Savannah)", median_income_pct: 52, rural: false, population: 3200, oz1_designated: true },
    "13055960400": { state: "Georgia", state_abbr: "GA", county: "Candler", median_income_pct: 55, rural: true, population: 700, oz1_designated: true },
    // Nevada
    "32003000500": { state: "Nevada", state_abbr: "NV", county: "Clark (Las Vegas)", median_income_pct: 48, rural: false, population: 5100, oz1_designated: true },
    "32510000200": { state: "Nevada", state_abbr: "NV", county: "Carson City", median_income_pct: 63, rural: true, population: 1300, oz1_designated: true },
    // Arizona
    "04013102600": { state: "Arizona", state_abbr: "AZ", county: "Maricopa (Phoenix)", median_income_pct: 45, rural: false, population: 4700, oz1_designated: true },
    "04019000200": { state: "Arizona", state_abbr: "AZ", county: "Pima (Tucson)", median_income_pct: 40, rural: false, population: 3800, oz1_designated: true },
    "04003940100": { state: "Arizona", state_abbr: "AZ", county: "Apache", median_income_pct: 28, rural: true, population: 600, oz1_designated: true },
    // Michigan
    "26163521300": { state: "Michigan", state_abbr: "MI", county: "Wayne (Detroit)", median_income_pct: 32, rural: false, population: 6500, oz1_designated: true },
    "26045010100": { state: "Michigan", state_abbr: "MI", county: "Eaton (Lansing area)", median_income_pct: 59, rural: true, population: 1200, oz1_designated: true },
    // Colorado
    "08031003502": { state: "Colorado", state_abbr: "CO", county: "Denver", median_income_pct: 44, rural: false, population: 4200, oz1_designated: true },
    "08059940100": { state: "Colorado", state_abbr: "CO", county: "Jefferson", median_income_pct: 66, rural: true, population: 1100, oz1_designated: true },
    // Washington
    "53033005302": { state: "Washington", state_abbr: "WA", county: "King (Seattle)", median_income_pct: 51, rural: false, population: 3900, oz1_designated: true },
    "53077940500": { state: "Washington", state_abbr: "WA", county: "Yakima", median_income_pct: 47, rural: true, population: 1600, oz1_designated: true },
    // Oregon
    "41051002100": { state: "Oregon", state_abbr: "OR", county: "Multnomah (Portland)", median_income_pct: 50, rural: false, population: 4100, oz1_designated: true },
    "41031950300": { state: "Oregon", state_abbr: "OR", county: "Jefferson", median_income_pct: 53, rural: true, population: 850, oz1_designated: true },
};
// OZ 2.0 eligibility: income ≤70% of state/metro median
const OZ2_INCOME_THRESHOLD = 70;
function isOz2Eligible(record) {
    return record.median_income_pct <= OZ2_INCOME_THRESHOLD;
}
function isQrofEligible(record) {
    return record.rural && record.population < 50000;
}
const server = new mcp_js_1.McpServer({
    name: "oz-zones",
    version: "1.0.0",
});
server.tool("lookup_zone", "Look up OZ 1.0 designation and OZ 2.0 eligibility for a census tract FIPS code", {
    fips_census_tract: zod_1.z.string().describe("11-digit FIPS census tract code (e.g. 06001402100)"),
}, async ({ fips_census_tract }) => {
    const tract = fips_census_tract.replace(/\s/g, "");
    const record = OZ_ZONES[tract];
    if (!record) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        fips_census_tract: tract,
                        found: false,
                        message: "Tract not found in embedded dataset. This dataset contains a representative subset of OZ 1.0 zones. For complete data, query HUD's CHAS or IRS Notice 2018-48.",
                        data_sources: [
                            "IRS Notice 2018-48: https://www.irs.gov/pub/irs-drop/n-18-48.pdf",
                            "HUD OZ mapping tool: https://hudgis-hud.opendata.arcgis.com/",
                        ],
                    }, null, 2),
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    fips_census_tract: tract,
                    found: true,
                    state: record.state,
                    state_abbr: record.state_abbr,
                    county: record.county,
                    oz1_designated: record.oz1_designated,
                    oz2_eligible: isOz2Eligible(record),
                    qrof_eligible: isQrofEligible(record),
                    tract_info: {
                        median_income_pct_of_state_metro_median: record.median_income_pct,
                        rural: record.rural,
                        population: record.population,
                        oz2_income_criterion: `≤${OZ2_INCOME_THRESHOLD}% state/metro median — ${record.median_income_pct <= OZ2_INCOME_THRESHOLD ? "MEETS" : "DOES NOT MEET"}`,
                    },
                }, null, 2),
            },
        ],
    };
});
server.tool("check_qrof_eligible", "Check if a census tract qualifies for Qualified Rural Opportunity Fund (QROF) treatment", {
    fips_census_tract: zod_1.z.string().describe("11-digit FIPS census tract code"),
}, async ({ fips_census_tract }) => {
    const tract = fips_census_tract.replace(/\s/g, "");
    const record = OZ_ZONES[tract];
    if (!record) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        fips_census_tract: tract,
                        found: false,
                        qrof_eligible: false,
                        message: "Tract not found in embedded dataset.",
                    }, null, 2),
                },
            ],
        };
    }
    const qrof = isQrofEligible(record);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    fips_census_tract: tract,
                    state: record.state,
                    county: record.county,
                    is_rural: record.rural,
                    population: record.population,
                    population_threshold: 50000,
                    qrof_eligible: qrof,
                    qrof_benefits: qrof ? {
                        step_up_at_5yr: "30% (vs 10% standard QOF)",
                        reinvestment_threshold: "50% property value (vs 100% standard)",
                        appreciation_exclusion: "Full at ≥10 years",
                    } : null,
                    notes: qrof
                        ? "QROF benefits apply under OZ 2.0 (effective Jan 1, 2027)"
                        : `Not QROF-eligible: ${!record.rural ? "not classified as rural" : `population ${record.population.toLocaleString()} exceeds 50k threshold`}`,
                }, null, 2),
            },
        ],
    };
});
server.tool("get_state_zones", "Get all OZ 1.0 designated tracts for a state with OZ 1.0/2.0 status", {
    state_abbr: zod_1.z.string().length(2).describe("Two-letter state abbreviation (e.g. CA, TX, NY)"),
}, async ({ state_abbr }) => {
    const abbr = state_abbr.toUpperCase();
    const tracts = Object.entries(OZ_ZONES)
        .filter(([, r]) => r.state_abbr === abbr)
        .map(([fips, r]) => ({
        fips_census_tract: fips,
        county: r.county,
        oz1_designated: r.oz1_designated,
        oz2_eligible: isOz2Eligible(r),
        qrof_eligible: isQrofEligible(r),
        median_income_pct: r.median_income_pct,
        rural: r.rural,
        population: r.population,
    }));
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    state_abbr: abbr,
                    total_tracts_in_dataset: tracts.length,
                    oz1_designated: tracts.filter(t => t.oz1_designated).length,
                    oz2_eligible: tracts.filter(t => t.oz2_eligible).length,
                    qrof_eligible: tracts.filter(t => t.qrof_eligible).length,
                    tracts,
                    note: "Embedded dataset contains representative subset. Full state list available in IRS Notice 2018-48.",
                }, null, 2),
            },
        ],
    };
});
server.tool("search_zones_by_county", "Search for OZ tracts within a specific county", {
    state_abbr: zod_1.z.string().length(2).describe("Two-letter state abbreviation"),
    county_name: zod_1.z.string().describe("County name (partial match supported)"),
}, async ({ state_abbr, county_name }) => {
    const abbr = state_abbr.toUpperCase();
    const search = county_name.toLowerCase();
    const tracts = Object.entries(OZ_ZONES)
        .filter(([, r]) => r.state_abbr === abbr && r.county.toLowerCase().includes(search))
        .map(([fips, r]) => ({
        fips_census_tract: fips,
        county: r.county,
        oz1_designated: r.oz1_designated,
        oz2_eligible: isOz2Eligible(r),
        qrof_eligible: isQrofEligible(r),
        median_income_pct: r.median_income_pct,
        rural: r.rural,
        population: r.population,
    }));
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    state_abbr: abbr,
                    county_search: county_name,
                    results_count: tracts.length,
                    tracts,
                }, null, 2),
            },
        ],
    };
});
server.tool("get_oz_timeline", "Get state-specific OZ nomination timelines and key dates", {
    state_abbr: zod_1.z.string().length(2).optional().describe("Two-letter state abbreviation (optional — omit for federal timeline)"),
}, async ({ state_abbr }) => {
    const today = new Date();
    const daysUntil = (d) => Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const federalDates = [
        { date: "2026-07-01", event: "Governor nominations for OZ 2.0 zones open", days_until: daysUntil(new Date("2026-07-01")) },
        { date: "2026-12-31", event: "OZ 1.0 deferred gain recognition deadline (hard)", days_until: daysUntil(new Date("2026-12-31")) },
        { date: "2027-01-01", event: "OZ 2.0 effective (OBBBA / One Big Beautiful Bill Act)", days_until: daysUntil(new Date("2027-01-01")) },
        { date: "2028-12-31", event: "OZ 1.0 designations expire", days_until: daysUntil(new Date("2028-12-31")) },
    ];
    // State-specific nomination window notes (representative)
    const stateNotes = {
        CA: "California: Governor nomination submission typically within 120 days of federal window opening",
        TX: "Texas: Governor's office coordinates with Texas Economic Development",
        NY: "New York: Empire State Development coordinates nomination process",
        FL: "Florida: Department of Economic Opportunity manages nominations",
        IL: "Illinois: DCEO manages nominations; prioritizes distressed communities",
        OH: "Ohio: Development Services Agency manages state nominations",
        PA: "Pennsylvania: DCED manages nominations",
        GA: "Georgia: GDEcD manages nominations",
        NC: "North Carolina: Commerce Department manages nominations",
        VA: "Virginia: VEDP manages nominations",
        AZ: "Arizona: ACA manages nominations",
        CO: "Colorado: OEDIT manages nominations",
        WA: "Washington: Commerce Department manages nominations",
    };
    const abbr = state_abbr?.toUpperCase();
    const stateNote = abbr ? stateNotes[abbr] : null;
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    state: abbr || "Federal",
                    federal_timeline: federalDates,
                    state_nomination_note: stateNote || (abbr ? `Contact ${abbr} Governor's economic development office for state-specific nomination timeline.` : "See individual state governor offices for state-level timelines."),
                    re_evaluation_cycle: "OZ 2.0 zones re-evaluated every 10 years",
                    oz2_eligibility_criteria: "≤70% state/metro median income; no contiguous tract rule",
                }, null, 2),
            },
        ],
    };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("oz-zones MCP server running on stdio\n");
}
main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map