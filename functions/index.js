const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const cors = require("cors")({ origin: true });

const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

function ymd(x) {
  return new Date(x).toISOString().slice(0, 10);
}

function normalizeQuotes(result) {
  const quotes = (result?.quotes || [])
    .map((q) => ({
      date: ymd(q.date),
      close: Number(q.close),
    }))
    .filter((q) => Number.isFinite(q.close));
  quotes.sort((a, b) => a.date.localeCompare(b.date));
  return quotes;
}

function normalizeDividends(result) {
  const divEvents = [];
  const divs = result?.events?.dividends;

  if (Array.isArray(divs)) {
    for (const d of divs) {
      if (!d?.date || d?.amount == null) continue;
      divEvents.push({ date: ymd(d.date), amount: Number(d.amount) });
    }
  } else if (divs && typeof divs === "object") {
    for (const k of Object.keys(divs)) {
      const d = divs[k];
      if (!d?.date || d?.amount == null) continue;
      divEvents.push({ date: ymd(d.date), amount: Number(d.amount) });
    }
  }

  divEvents
    .filter((d) => Number.isFinite(d.amount))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 같은 날짜 중복 합산
  const map = new Map();
  for (const d of divEvents) {
    map.set(d.date, (map.get(d.date) || 0) + d.amount);
  }
  return Array.from(map.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 주가/배당 히스토리
 * GET /api/schdHistory?ticker=SCHD&start=2012-01-01&end=2024-12-31
 */
exports.schdHistory = onRequest(
  { region: "asia-northeast3" },
  (req, res) =>
    cors(req, res, async () => {
      try {
        const ticker = (req.query.ticker || "SCHD").toString();
        const start = (req.query.start || "2011-01-01").toString();
        const end = (req.query.end || ymd(Date.now())).toString();

        const result = await yahooFinance.chart(ticker, {
          period1: start,
          period2: end,
          interval: "1d",
          events: "div,splits",
        });

        const prices = normalizeQuotes(result);
        const dividends = normalizeDividends(result);

        res.set("Cache-Control", "public, max-age=3600"); // 1시간 캐시
        return res.status(200).json({
          ticker,
          start,
          end,
          firstDate: prices[0]?.date || null,
          lastDate: prices[prices.length - 1]?.date || null,
          prices,
          dividends,
        });
      } catch (e) {
        logger.error(e);
        return res.status(500).json({ error: String(e) });
      }
    })
);

/**
 * USD/KRW 환율 히스토리 (1 USD = ? KRW)
 * GET /api/fxHistory?start=2012-01-01&end=2024-12-31
 *
 * Yahoo에서 보통 "KRW=X"가 USDKRW를 의미.
 * 만약 데이터가 비면 "USDKRW=X"로 재시도.
 */
exports.fxHistory = onRequest(
  { region: "asia-northeast3" },
  (req, res) =>
    cors(req, res, async () => {
      try {
        const start = (req.query.start || "2011-01-01").toString();
        const end = (req.query.end || ymd(Date.now())).toString();

        async function fetchFx(symbol) {
          const result = await yahooFinance.chart(symbol, {
            period1: start,
            period2: end,
            interval: "1d",
          });
          return normalizeQuotes(result);
        }

        let prices = await fetchFx("KRW=X");
        if (!prices || prices.length < 10) {
          prices = await fetchFx("USDKRW=X");
        }

        res.set("Cache-Control", "public, max-age=3600");
        return res.status(200).json({
          pair: "USD/KRW",
          start,
          end,
          firstDate: prices[0]?.date || null,
          lastDate: prices[prices.length - 1]?.date || null,
          prices, // [{date, close}] close = KRW per USD
        });
      } catch (e) {
        logger.error(e);
        return res.status(500).json({ error: String(e) });
      }
    })
);
