#!/usr/bin/env node
"use strict";
/**
 * @gonzih/oz-timeline — OZ Deadlines, Investment Windows & Nomination Schedules MCP Server
 *
 * Provides tools for tracking all OZ 1.0 and OZ 2.0 key dates,
 * 180-day investment windows, and state nomination schedules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
function daysUntil(target, from) {
    const ref = from || new Date();
    return Math.ceil((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}
function urgencyLevel(days) {
    if (days < 0)
        return "EXPIRED";
    if (days <= 30)
        return "CRITICAL";
    if (days <= 90)
        return "URGENT";
    if (days <= 180)
        return "SOON";
    return "OK";
}
const STATIC_DEADLINES = [
    {
        date: "2026-07-01",
        event: "Governor nominations for OZ 2.0 zones open",
        category: "OZ_2.0",
    },
    {
        date: "2026-12-31",
        event: "OZ 1.0 deferred gain recognition deadline — all OZ 1.0 deferred gains must be included in income",
        category: "OZ_1.0",
    },
    {
        date: "2027-01-01",
        event: "OZ 2.0 effective (OBBBA / One Big Beautiful Bill Act) — permanent incentive program begins",
        category: "OZ_2.0",
    },
    {
        date: "2028-12-31",
        event: "OZ 1.0 designations expire",
        category: "OZ_1.0",
    },
    {
        date: "2036-12-31",
        event: "First OZ 2.0 zone re-evaluation cycle (10-year cadence from 2027)",
        category: "OZ_2.0",
    },
];
const server = new mcp_js_1.McpServer({
    name: "oz-timeline",
    version: "1.0.0",
});
server.tool("get_all_deadlines", "Get all OZ key dates sorted chronologically with days remaining", {}, async () => {
    const today = new Date();
    const deadlines = STATIC_DEADLINES.map(d => ({
        ...d,
        days_until: daysUntil(new Date(d.date), today),
        urgency: urgencyLevel(daysUntil(new Date(d.date), today)),
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const upcoming = deadlines.filter(d => (d.days_until ?? 0) >= 0);
    const expired = deadlines.filter(d => (d.days_until ?? 0) < 0);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    reference_date: today.toISOString().split("T")[0],
                    upcoming_deadlines: upcoming,
                    expired_deadlines: expired,
                    summary: {
                        oz1_gain_recognition_deadline: "Dec 31, 2026",
                        oz2_effective: "Jan 1, 2027",
                        nomination_window_opens: "Jul 1, 2026",
                        days_until_oz1_deadline: daysUntil(new Date("2026-12-31"), today),
                        days_until_oz2_effective: daysUntil(new Date("2027-01-01"), today),
                    },
                }, null, 2),
            },
        ],
    };
});
server.tool("check_investment_window", "Check 180-day OZ investment window for a given gain recognition date", {
    gain_recognition_date: zod_1.z.string().describe("Date capital gain was recognized (YYYY-MM-DD)"),
}, async ({ gain_recognition_date }) => {
    const gainDate = new Date(gain_recognition_date);
    const deadline = new Date(gainDate);
    deadline.setDate(deadline.getDate() + 180);
    const today = new Date();
    const days = daysUntil(deadline, today);
    const oz1Deadline = new Date("2026-12-31");
    const oz2Start = new Date("2027-01-01");
    // OZ 1.0 applies if gain occurred before Jan 1, 2027 (and reinvestment window within 2026 cutoff)
    const oz1Applicable = gainDate < oz2Start && deadline <= new Date("2027-06-30");
    // OZ 2.0 applies for gains recognized on or after Jan 1, 2027
    const oz2Applicable = gainDate >= oz2Start || gainDate >= new Date("2026-07-01");
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    gain_recognition_date,
                    investment_deadline_180d: deadline.toISOString().split("T")[0],
                    days_remaining: days,
                    is_expired: days < 0,
                    urgency: urgencyLevel(days),
                    oz1_applicable: oz1Applicable,
                    oz2_applicable: oz2Applicable,
                    oz1_gain_deadline: oz1Deadline.toISOString().split("T")[0],
                    caution: gainDate < oz2Start
                        ? "OZ 1.0 applies: ensure gain is recognized and reinvested before Dec 31, 2026 deadline"
                        : "OZ 2.0 applies: no hard Dec 31, 2026 deadline",
                    notes: [
                        "180-day window starts from date of capital gain recognition",
                        "For pass-through entities, investors may use partnership's 180-day window or their own",
                        "Extension available for gains from pass-through entities — check IRC §1400Z-2(a)(1)(A)",
                    ],
                }, null, 2),
            },
        ],
    };
});
server.tool("days_until_oz2", "Calculate days until OZ 2.0 is effective (Jan 1, 2027)", {
    reference_date: zod_1.z.string().optional().describe("Reference date (YYYY-MM-DD). Defaults to today."),
}, async ({ reference_date }) => {
    const ref = reference_date ? new Date(reference_date) : new Date();
    const oz2Date = new Date("2027-01-01");
    const days = daysUntil(oz2Date, ref);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    reference_date: ref.toISOString().split("T")[0],
                    oz2_effective_date: "2027-01-01",
                    days_until_oz2: days,
                    is_oz2_active: days <= 0,
                    urgency: urgencyLevel(days),
                    months_approximate: Math.round(days / 30.44 * 10) / 10,
                    what_changes_on_oz2: [
                        "OZ 2.0 becomes permanent (no sunset)",
                        "QROF (rural) designation available: 30% step-up at 5yr vs 10% standard",
                        "Reduced reinvestment threshold for QROF: 50% property value vs 100%",
                        "New annual reporting under IRC §§6039K and 6039L",
                        "~6,304 new eligible tracts (tighter ≤70% median income criterion)",
                        "No contiguous tract rule in OZ 2.0",
                        "Zone re-evaluation every 10 years",
                    ],
                }, null, 2),
            },
        ],
    };
});
server.tool("get_nomination_schedule", "Get governor nomination schedule and timelines for OZ 2.0 zone designations", {
    state_abbr: zod_1.z.string().length(2).optional().describe("Two-letter state abbreviation (optional — omit for all states summary)"),
}, async ({ state_abbr }) => {
    const today = new Date();
    const nominationWindowOpen = new Date("2026-07-01");
    const daysToWindow = daysUntil(nominationWindowOpen, today);
    // Representative state nomination timelines
    const stateSchedules = {
        AL: { agency: "Alabama Department of Commerce", typical_window_days: 90, notes: "Coordinates with ADECA for distressed community input" },
        AK: { agency: "Alaska Department of Commerce", typical_window_days: 120, notes: "Remote and rural tracts prioritized" },
        AZ: { agency: "Arizona Commerce Authority", typical_window_days: 90, notes: "Focuses on innovation districts and rural counties" },
        AR: { agency: "Arkansas Economic Development Commission", typical_window_days: 90, notes: "Rural and delta region tracts prioritized" },
        CA: { agency: "Governor's Office of Business & Economic Development (GO-Biz)", typical_window_days: 120, notes: "Statewide competitive process; 8 zones per statute" },
        CO: { agency: "Colorado Office of Economic Development (OEDIT)", typical_window_days: 90, notes: "Application process for communities" },
        CT: { agency: "Connecticut Department of Economic & Community Development", typical_window_days: 90, notes: "Urban and suburban mix" },
        DE: { agency: "Delaware Division of Small Business", typical_window_days: 60, notes: "Small state — fewer tracts" },
        FL: { agency: "Florida Department of Economic Opportunity", typical_window_days: 90, notes: "Large urban and rural coastal tracts" },
        GA: { agency: "Georgia Department of Economic Development (GDEcD)", typical_window_days: 90, notes: "Prioritizes distressed rural counties" },
        HI: { agency: "Hawaii Department of Business, Economic Development & Tourism", typical_window_days: 120, notes: "Island-specific considerations" },
        ID: { agency: "Idaho Department of Commerce", typical_window_days: 90, notes: "Rural tracts and small cities" },
        IL: { agency: "Illinois Department of Commerce & Economic Opportunity (DCEO)", typical_window_days: 120, notes: "Urban (Chicago) and rural downstate focus" },
        IN: { agency: "Indiana Economic Development Corporation (IEDC)", typical_window_days: 90, notes: "Rust belt and rural community focus" },
        IA: { agency: "Iowa Economic Development Authority", typical_window_days: 90, notes: "Agricultural and rural community focus" },
        KS: { agency: "Kansas Department of Commerce", typical_window_days: 90, notes: "Rural and small city focus" },
        KY: { agency: "Kentucky Cabinet for Economic Development", typical_window_days: 90, notes: "Appalachian region and rural counties" },
        LA: { agency: "Louisiana Department of Economic Development", typical_window_days: 90, notes: "Gulf Coast and rural parishes" },
        ME: { agency: "Maine Department of Economic & Community Development", typical_window_days: 90, notes: "Rural coastal and interior" },
        MD: { agency: "Maryland Department of Commerce", typical_window_days: 90, notes: "Urban Baltimore and rural Eastern Shore" },
        MA: { agency: "Massachusetts Executive Office of Housing & Economic Development", typical_window_days: 120, notes: "Gateway cities and rural western MA" },
        MI: { agency: "Michigan Economic Development Corporation (MEDC)", typical_window_days: 90, notes: "Detroit metro and rural UP focus" },
        MN: { agency: "Minnesota Department of Employment & Economic Development (DEED)", typical_window_days: 90, notes: "Twin Cities and Greater MN" },
        MS: { agency: "Mississippi Development Authority", typical_window_days: 90, notes: "Delta region and rural focus" },
        MO: { agency: "Missouri Department of Economic Development", typical_window_days: 90, notes: "St. Louis, KC metro and rural" },
        MT: { agency: "Montana Department of Commerce", typical_window_days: 90, notes: "Rural and tribal lands focus" },
        NE: { agency: "Nebraska Department of Economic Development", typical_window_days: 90, notes: "Rural and small city focus" },
        NV: { agency: "Nevada Governor's Office of Economic Development (GOED)", typical_window_days: 90, notes: "Las Vegas metro and rural counties" },
        NH: { agency: "New Hampshire Division of Economic Development", typical_window_days: 60, notes: "Small state; urban and rural mix" },
        NJ: { agency: "New Jersey Economic Development Authority (NJEDA)", typical_window_days: 90, notes: "Urban cores and transitional neighborhoods" },
        NM: { agency: "New Mexico Economic Development Department", typical_window_days: 90, notes: "Rural, tribal and border communities" },
        NY: { agency: "Empire State Development (ESD)", typical_window_days: 120, notes: "NYC, upstate cities and rural" },
        NC: { agency: "North Carolina Department of Commerce", typical_window_days: 90, notes: "Rural east and urban piedmont" },
        ND: { agency: "North Dakota Department of Commerce", typical_window_days: 90, notes: "Rural and small city focus" },
        OH: { agency: "Ohio Development Services Agency", typical_window_days: 90, notes: "Rust belt cities and rural Appalachia" },
        OK: { agency: "Oklahoma Department of Commerce", typical_window_days: 90, notes: "Rural and tribal communities" },
        OR: { agency: "Oregon Business Development Department", typical_window_days: 90, notes: "Portland metro and rural counties" },
        PA: { agency: "Pennsylvania DCED", typical_window_days: 90, notes: "Philadelphia, Pittsburgh and rural" },
        RI: { agency: "Rhode Island Commerce Corporation", typical_window_days: 60, notes: "Providence and smaller cities" },
        SC: { agency: "South Carolina Department of Commerce", typical_window_days: 90, notes: "Coastal and rural upstate" },
        SD: { agency: "South Dakota Governor's Office of Economic Development", typical_window_days: 90, notes: "Rural and reservation communities" },
        TN: { agency: "Tennessee Department of Economic & Community Development", typical_window_days: 90, notes: "Nashville, Memphis and rural" },
        TX: { agency: "Texas Governor's Office / Texas Economic Development", typical_window_days: 90, notes: "Large state; diverse urban-rural mix" },
        UT: { agency: "Utah Governor's Office of Economic Opportunity", typical_window_days: 90, notes: "Wasatch Front and rural counties" },
        VT: { agency: "Vermont Agency of Commerce & Community Development", typical_window_days: 60, notes: "Small rural state" },
        VA: { agency: "Virginia Economic Development Partnership (VEDP)", typical_window_days: 90, notes: "Southwest VA, Northern VA and rural" },
        WA: { agency: "Washington Department of Commerce", typical_window_days: 90, notes: "Seattle metro and eastern WA rural" },
        WV: { agency: "West Virginia Development Office", typical_window_days: 90, notes: "Coal country and rural focus" },
        WI: { agency: "Wisconsin Economic Development Corporation (WEDC)", typical_window_days: 90, notes: "Milwaukee metro and rural" },
        WY: { agency: "Wyoming Business Council", typical_window_days: 60, notes: "Rural and energy communities" },
        DC: { agency: "DC Office of Planning / Deputy Mayor for Planning & Economic Development", typical_window_days: 60, notes: "Urban ward-based focus" },
        PR: { agency: "Puerto Rico Department of Economic Development and Commerce (DDEC)", typical_window_days: 90, notes: "All 78 municipalities eligible" },
        VI: { agency: "U.S. Virgin Islands Economic Development Authority", typical_window_days: 90, notes: "Territory-wide consideration" },
        GU: { agency: "Guam Economic Development Authority", typical_window_days: 90, notes: "Territory-wide consideration" },
    };
    if (state_abbr) {
        const abbr = state_abbr.toUpperCase();
        const schedule = stateSchedules[abbr];
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        state: abbr,
                        nomination_window_opens_federally: "2026-07-01",
                        days_until_federal_window_opens: daysToWindow,
                        nominating_agency: schedule?.agency || `${abbr} Governor's economic development office`,
                        typical_state_window_days: schedule?.typical_window_days || 90,
                        state_notes: schedule?.notes || "Contact governor's office for state-specific process",
                        estimated_state_deadline: (() => {
                            const stateDeadline = new Date("2026-07-01");
                            stateDeadline.setDate(stateDeadline.getDate() + (schedule?.typical_window_days || 90));
                            return stateDeadline.toISOString().split("T")[0];
                        })(),
                    }, null, 2),
                },
            ],
        };
    }
    // All states summary
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    federal_nomination_window_opens: "2026-07-01",
                    days_until_federal_window: daysToWindow,
                    total_states_territories: Object.keys(stateSchedules).length,
                    typical_state_window: "60-120 days after federal window opens",
                    state_schedules: stateSchedules,
                    notes: [
                        "Governor nominations for OZ 2.0 open July 1, 2026",
                        "Each governor designates census tracts meeting ≤70% state/metro median income criterion",
                        "No contiguous tract rule in OZ 2.0 (unlike OZ 1.0)",
                        "~6,304 eligible tracts nationally under OZ 2.0 criteria",
                        "Zones re-evaluated every 10 years from 2027",
                    ],
                }, null, 2),
            },
        ],
    };
});
server.tool("oz1_deadline_check", "Check the OZ 1.0 Dec 31, 2026 gain recognition deadline and urgency", {}, async () => {
    const today = new Date();
    const deadline = new Date("2026-12-31");
    const days = daysUntil(deadline, today);
    const urgency = urgencyLevel(days);
    const investmentDeadline180 = new Date(today);
    investmentDeadline180.setDate(today.getDate() + 180);
    const oz1WindowClosed = investmentDeadline180 > deadline;
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    reference_date: today.toISOString().split("T")[0],
                    oz1_deadline: "2026-12-31",
                    days_until_deadline: days,
                    is_expired: days < 0,
                    urgency,
                    oz1_180_day_window_still_usable: !oz1WindowClosed,
                    last_date_to_recognize_gain_for_oz1: (() => {
                        // To invest within OZ 1.0 before Dec 31 2026, gain must be recognized ≤180 days before
                        const lastGainDate = new Date("2026-12-31");
                        lastGainDate.setDate(lastGainDate.getDate() - 180);
                        return lastGainDate.toISOString().split("T")[0];
                    })(),
                    action_items: days > 0 ? [
                        "Confirm any deferred OZ 1.0 gains will be reported by Dec 31, 2026",
                        "Ensure QOF holds qualifying property through Dec 31, 2026",
                        urgency === "CRITICAL" || urgency === "URGENT"
                            ? "URGENT: consult tax advisor immediately about OZ 1.0 deadline exposure"
                            : "Review OZ 1.0 portfolio for 90% asset test compliance",
                        "Plan transition to OZ 2.0 for new investments beginning Jan 1, 2027",
                    ] : [
                        "OZ 1.0 deadline has passed",
                        "All OZ 1.0 deferred gains were recognized Dec 31, 2026",
                        "New investments use OZ 2.0 framework (effective Jan 1, 2027)",
                    ],
                    oz2_note: "OZ 2.0 (OBBBA) takes effect Jan 1, 2027 with permanent incentives and QROF rural enhancements",
                }, null, 2),
            },
        ],
    };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("oz-timeline MCP server running on stdio\n");
}
main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map