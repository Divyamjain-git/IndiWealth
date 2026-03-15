/**
 * Inflation Service
 * Fetches live India CPI data from data.gov.in (MoSPI / official GoI source)
 * Falls back to last known value → historical average if API is unavailable.
 *
 * data.gov.in resource IDs used:
 *   - CPI All India Combined (General): 9ef84268-d588-465a-a308-a864a43d0070
 *
 * API docs: https://data.gov.in/ogpl_api/v1.0/resource/
 */

const https = require('https');

// ── In-memory cache (no Redis needed) ──────────────────────────────────────────
let cache = {
  rate: null,          // latest YoY CPI % (e.g. 4.83)
  month: null,         // "YYYY-MM" string of the data point
  fetchedAt: null,     // Date when last fetched
  historical: [],      // last N monthly rates for trend display
};

// Cache TTL: 12 hours (CPI is released monthly, so daily is plenty)
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// ── Fallback chain ──────────────────────────────────────────────────────────────
// RBI target mid-point (4%) used if all live fetches fail and cache is cold.
const RBI_TARGET_RATE = 4.0;

// Known recent values (Jan 2024 – Jan 2026) as a hard fallback
const HISTORICAL_FALLBACK = [
  { month: '2024-01', rate: 5.10 }, { month: '2024-02', rate: 5.09 },
  { month: '2024-03', rate: 4.85 }, { month: '2024-04', rate: 4.83 },
  { month: '2024-05', rate: 4.75 }, { month: '2024-06', rate: 5.08 },
  { month: '2024-07', rate: 3.54 }, { month: '2024-08', rate: 3.65 },
  { month: '2024-09', rate: 5.49 }, { month: '2024-10', rate: 6.21 },
  { month: '2024-11', rate: 5.48 }, { month: '2024-12', rate: 5.22 },
  { month: '2025-01', rate: 4.26 }, { month: '2025-02', rate: 3.61 },
  { month: '2025-03', rate: 3.34 }, { month: '2025-04', rate: 3.16 },
  { month: '2025-05', rate: 2.82 }, { month: '2025-06', rate: 2.10 },
  { month: '2025-07', rate: 3.35 }, { month: '2025-08', rate: 3.65 },
  { month: '2025-09', rate: 3.83 }, { month: '2025-10', rate: 0.25 },
  { month: '2025-11', rate: 0.71 }, { month: '2025-12', rate: 1.33 },
  { month: '2026-01', rate: 2.75 },
];

// ── HTTP helper (no axios dependency) ──────────────────────────────────────────
const fetchJSON = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });

// ── Main fetch from data.gov.in ─────────────────────────────────────────────────
const fetchFromDataGovIn = async () => {
  // Resource: "Consumer Price Index (CPI) - All India - Combined - General"
  // Sorted by date descending, limit 24 records for trend
  const resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
  const url = `https://api.data.gov.in/resource/${resourceId}?api-key=579b464db66ec23bdd000001cdd3946e44ce4aab0ddc6c78a83d3f5e&format=json&limit=24&sort[Month]=desc`;

  const json = await fetchJSON(url);
  if (!json?.records?.length) throw new Error('No records returned');

  const records = json.records
    .filter(r => r['Inflation Rate (YoY)'] !== undefined || r['inflation_rate'] !== undefined)
    .map(r => {
      const rawRate = r['Inflation Rate (YoY)'] ?? r['inflation_rate'] ?? r['Rate'];
      const rawMonth = r['Month'] ?? r['month'] ?? r['Date'];
      return { rate: parseFloat(rawRate), month: String(rawMonth) };
    })
    .filter(r => !isNaN(r.rate))
    .sort((a, b) => b.month.localeCompare(a.month));

  if (!records.length) throw new Error('No parseable CPI records');

  return records;
};

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * getLiveInflationRate()
 * Returns { rate, month, source, historical, fetchedAt }
 *
 * source: 'live' | 'cache' | 'fallback'
 */
const getLiveInflationRate = async () => {
  // 1. Return from cache if fresh
  if (cache.rate !== null && cache.fetchedAt && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return {
      rate: cache.rate,
      month: cache.month,
      source: 'cache',
      historical: cache.historical,
      fetchedAt: cache.fetchedAt,
    };
  }

  // 2. Try live fetch
  try {
    const records = await fetchFromDataGovIn();
    const latest = records[0];
    const historical = records.slice(0, 13).reverse(); // oldest→newest for chart

    cache = {
      rate: latest.rate,
      month: latest.month,
      fetchedAt: Date.now(),
      historical,
    };

    return { rate: latest.rate, month: latest.month, source: 'live', historical, fetchedAt: cache.fetchedAt };
  } catch (err) {
    console.warn('[InflationService] Live fetch failed:', err.message);
  }

  // 3. Use stale cache if available
  if (cache.rate !== null) {
    return {
      rate: cache.rate,
      month: cache.month,
      source: 'cache',
      historical: cache.historical,
      fetchedAt: cache.fetchedAt,
    };
  }

  // 4. Hard fallback — built-in historical data
  const fallbackLatest = HISTORICAL_FALLBACK[HISTORICAL_FALLBACK.length - 1];
  return {
    rate: fallbackLatest.rate,
    month: fallbackLatest.month,
    source: 'fallback',
    historical: HISTORICAL_FALLBACK.slice(-13),
    fetchedAt: null,
  };
};

// ── Computation helpers (used by controllers) ───────────────────────────────────

/**
 * inflationAdjustedAmount(presentAmount, annualRate%, years)
 * → future cost in today's money terms
 */
const inflationAdjustedAmount = (presentAmount, annualRatePercent, years) => {
  const r = annualRatePercent / 100;
  return presentAmount * Math.pow(1 + r, years);
};

/**
 * purchasingPowerDecay(amount, annualRate%, years)
 * → what today's ₹X is worth after N years of inflation
 */
const purchasingPowerDecay = (amount, annualRatePercent, years) => {
  const r = annualRatePercent / 100;
  return amount / Math.pow(1 + r, years);
};

/**
 * realReturn(nominalReturnPercent, inflationPercent)
 * Fisher equation: real = (1 + nominal) / (1 + inflation) - 1
 */
const realReturn = (nominalReturnPercent, inflationPercent) => {
  const n = nominalReturnPercent / 100;
  const i = inflationPercent / 100;
  return ((1 + n) / (1 + i) - 1) * 100;
};

/**
 * inflationAdjustedGoalSIP(targetFutureAmount, inflationRate%, years, expectedReturn%)
 * Computes required monthly SIP to meet inflation-adjusted target
 */
const inflationAdjustedGoalSIP = (nominalTarget, inflationRate, years, expectedAnnualReturn = 7) => {
  const realTarget = inflationAdjustedAmount(nominalTarget, inflationRate, years);
  const monthlyRate = expectedAnnualReturn / 100 / 12;
  const n = years * 12;
  if (monthlyRate === 0) return realTarget / n;
  // FV of SIP = P * [((1+r)^n - 1) / r]
  const sip = (realTarget * monthlyRate) / (Math.pow(1 + monthlyRate, n) - 1);
  return Math.ceil(sip);
};

module.exports = {
  getLiveInflationRate,
  inflationAdjustedAmount,
  purchasingPowerDecay,
  realReturn,
  inflationAdjustedGoalSIP,
  RBI_TARGET_RATE,
};
