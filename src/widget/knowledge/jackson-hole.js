/* Jackson Hole knowledge — ported from omni/src/data/parent.ts (jacksonHole template).
 *
 * This is a SNAPSHOT/COPY of omni's curated knowledge, de-TypeScript'd to plain
 * JS so the vanilla, key-less, statically-hosted widget can consume it without a
 * cross-repo import or a backend. omni remains the source of truth — resync this
 * file when omni's JH template changes. (A future slice could fetch this from
 * omni's API / ODIN instead of snapshotting.)
 *
 * Note types mirror omni: 'critical' (hard guardrail), 'rule', 'script'
 * (guest-facing phrasing), 'faq'.
 */

export const JH_KNOWLEDGE = {
  resortName: 'Jackson Hole Mountain Resort',
  officialUrl: 'https://www.jacksonhole.com',
  contactEmail: 'info@jacksonhole.com',
  contactPhone: '855-679-7246',
  multiPass: ['Mountain Collective', 'Ikon'],

  // Curated category tree (official resort links + typed notes). Faithful copy
  // of omni's jacksonHole.template.knowledgeGroups.
  knowledgeGroups: [
    {
      id: 'resort-info', emoji: '🏔️', label: 'Resort Info by Category',
      entries: [
        { key: 'hours', label: 'Hours of operation', url: '', enabled: true },
        { key: 'contact', label: 'Contact', url: '', enabled: true },
        { key: 'location', label: 'Location', url: '', enabled: true },
        { key: 'trail-maps', label: 'Trail Maps & Slope Difficulty', url: 'https://www.jacksonhole.com/maps/mountain-winter', enabled: true },
        { key: 'terrain-status', label: 'Terrain Status', url: '', enabled: false },
        { key: 'snow-reports', label: 'Snow Reports & Weather', url: 'https://www.jacksonhole.com/mountain-report', enabled: true },
        { key: 'webcams', label: 'Live webcams', url: 'https://www.jacksonhole.com/live-mountain-cams', enabled: true },
      ],
    },
    {
      id: 'tickets', emoji: '🎫', label: 'Tickets',
      entries: [
        {
          key: 'lift-tickets', label: 'Lift Tickets', url: 'https://www.jacksonhole.com/lift-tickets', enabled: true,
          notes: [
            { id: 'n1', type: 'critical', text: 'Never quote rates or prices. Direct guests to 855-679-7246 for pricing.' },
            { id: 'n2', type: 'rule', text: 'No single-ride tram or gondola tickets. Use date-based logic for the correct link.' },
            { id: 'n3', type: 'script', text: 'Ticket prices vary by date of visit and the best pricing is found online in advance of arrival.' },
          ],
        },
        { key: 'deals-packages', label: 'Deals & Packages', url: '', enabled: false },
      ],
    },
    {
      id: 'season-passes', emoji: '🎟️', label: 'Season Passes',
      entries: [
        {
          key: 'types-of-passes', label: 'Types of Season Passes', url: 'https://www.jacksonhole.com/season-pass', enabled: true,
          notes: [
            { id: 'sp1', type: 'critical', text: 'Winter 2026–2027 in-person sale concluded. Online sales begin May 13, 2026.' },
            { id: 'sp2', type: 'rule', text: 'Rates subject to change without notice; passes do sell out. No payment plans.' },
            { id: 'sp3', type: 'script', text: 'Different passes at Jackson Hole offer unique benefits. Visit our Season Pass page for full details.' },
          ],
        },
        { key: 'pass-sale-launch', label: 'Sale Launch Date', url: '', enabled: false },
        { key: 'tiered-pricing', label: 'Tiered Pricing', url: '', enabled: false },
      ],
    },
    {
      id: 'lessons', emoji: '🎿', label: 'Ski & Snowboard Lessons',
      entries: [
        { key: 'adult-lessons', label: 'Adult Lessons', url: '', enabled: false },
        { key: 'kids-lessons', label: 'Kids Lessons', url: '', enabled: false },
        { key: 'private-lessons', label: 'Private Lessons', url: '', enabled: false },
        { key: 'group-lessons', label: 'Group Lessons', url: '', enabled: false },
      ],
    },
    {
      id: 'rentals', emoji: '🎿', label: 'Ski & Snowboard Rentals',
      entries: [
        { key: 'ski-rentals', label: 'Ski Rentals', url: '', enabled: false },
        { key: 'snowboard-rentals', label: 'Snowboard Rentals', url: '', enabled: false },
        { key: 'demo-rentals', label: 'Demo Rentals', url: '', enabled: false },
      ],
    },
    {
      id: 'refund-policies', emoji: '📆', label: 'Refund Policies',
      entries: [
        {
          key: 'refund-tickets', label: 'Tickets', url: '', enabled: true,
          notes: [
            { id: 'rt1', type: 'critical', text: 'Day-of refunds only for full-mountain closures, not partial closures.' },
            { id: 'rt2', type: 'rule', text: '24-hour cancellation window for online tickets.' },
            { id: 'rt3', type: 'rule', text: 'Day-of: non-refundable.' },
            { id: 'rt4', type: 'script', text: 'We can credit the ticket for a future visit if you cancel more than 24 hours out.' },
          ],
        },
        {
          key: 'refund-passes', label: 'Passes', url: '', enabled: true,
          notes: [
            { id: 'rp1', type: 'rule', text: 'No refunds after season starts.' },
            { id: 'rp2', type: 'rule', text: 'Buy-back program available — see Guest Services on arrival.' },
          ],
        },
        { key: 'refund-lodging', label: 'Lodging', url: '', enabled: false },
        { key: 'refund-lessons-rentals', label: 'Lessons & Rentals', url: '', enabled: false },
      ],
    },
    {
      id: 'lodging', emoji: '🏨', label: 'Lodging',
      entries: [
        { key: 'lodging-options', label: 'Lodging Options', url: 'https://www.jacksonhole.com/lodging', enabled: true },
      ],
    },
    {
      id: 'dining', emoji: '🍽', label: 'Dining & Après',
      entries: [
        { key: 'on-mountain-dining', label: 'On-Mountain Dining', url: 'https://www.jacksonhole.com/dining', enabled: true },
      ],
    },
    {
      id: 'parking-transit', emoji: '🚌', label: 'Parking & Transit',
      entries: [
        { key: 'parking', label: 'Parking', url: 'https://www.jacksonhole.com/getting-around', enabled: true },
        { key: 'shuttles', label: 'Shuttles', url: '', enabled: false },
        { key: 'directions', label: 'Directions', url: '', enabled: false },
      ],
    },
    {
      id: 'events', emoji: '📅', label: 'Events',
      entries: [
        { key: 'resort-events', label: 'Resort Events & Activities', url: 'https://www.jacksonhole.com/events', enabled: true },
      ],
    },
  ],

  // Resort-level flows omni marks active (live data the widget already fetches).
  activeFlows: ['get_snow_report', 'get_lift_status', 'get_weather', 'get_parking', 'get_events'],
};

// Ordered keyword → official-link map, derived from the enabled knowledgeGroups
// entries above. First match wins, so list more specific topics first.
const TOPIC_LINKS = [
  { re: /\b(trail ?maps?|slope difficulty|piste map|terrain map)\b/, label: 'trail maps', url: 'https://www.jacksonhole.com/maps/mountain-winter' },
  { re: /\b(webcams?|web ?cam|live ?cams?|live view|live feed|cameras?)\b/, label: 'live webcams', url: 'https://www.jacksonhole.com/live-mountain-cams' },
  { re: /\b(snow|powder|snow ?report|mountain report|conditions|weather|forecast)\b/, label: 'snow report & conditions', url: 'https://www.jacksonhole.com/mountain-report' },
  { re: /\b(season ?pass(es)?|ikon|mountain collective|epic pass)\b/, label: 'season passes', url: 'https://www.jacksonhole.com/season-pass' },
  { re: /\b(tickets?|day pass|lift ticket)\b/, label: 'lift tickets', url: 'https://www.jacksonhole.com/lift-tickets' },
  { re: /\b(lodging|hotels?|where to stay|accommodations?|stay)\b/, label: 'lodging', url: 'https://www.jacksonhole.com/lodging' },
  { re: /\b(dining|restaurants?|where to eat|food|après|apres|breakfast|lunch|dinner)\b/, label: 'dining & après', url: 'https://www.jacksonhole.com/dining' },
  { re: /\b(parking|shuttles?|getting around|directions|transit|bus)\b/, label: 'parking & getting around', url: 'https://www.jacksonhole.com/getting-around' },
  { re: /\b(events?|festivals?|concerts?|things to do)\b/, label: 'events', url: 'https://www.jacksonhole.com/events' },
];

/** Return { label, url } of the best-matching official resort link for a query,
 *  or null if no topic matches. */
export function topicLink(query) {
  var q = (query || '').toLowerCase();
  for (var i = 0; i < TOPIC_LINKS.length; i++) {
    if (TOPIC_LINKS[i].re.test(q)) {
      return { label: TOPIC_LINKS[i].label, url: TOPIC_LINKS[i].url };
    }
  }
  return null;
}
