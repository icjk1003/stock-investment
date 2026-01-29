const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const cors = require("cors")({ origin: true });
const yahooFinance = require("yahoo-finance2").default;

// GET /api/schdHistory?ticker=SCHD&start=2012-01-01&end=2026-01-29
exports.schdHistory = functions
  .region("asia-northeast3") // 서울 리전(원하면 변경)
  .https.onRequest((req, res) =>
    cors(req, res, async () => {
      try {
        const ticker = (req.query.ticker || "SCHD").toString();
        const start = (req.query.start || "2011-01-01").toString();
        const end = (req.query.end || new Date().toISOString().slice(0, 10)).toString();

        const result = await yahooFinance.chart(ticker, {
          period1: start,
          period2: end,
          interval: "1d",
          events: "div,splits",
        });

        const prices = (result?.quotes || [])
          .map((q) => ({
            date: new Date(q.date).toISOString().slice(0, 10),
            close: Number(q.close),
          }))
          .filter((q) => Number.isFinite(q.close));

        const divEvents = [];
        const divs = result?.events?.dividends;

        if (Array.isArray(divs)) {
          for (const d of divs) {
            if (!d?.date || d?.amount == null) continue;
            divEvents.push({
              date: new Date(d.date).toISOString().slice(0, 10),
              amount: Number(d.amount),
            });
          }
        } else if (divs && typeof divs === "object") {
          for (const k of Object.keys(divs)) {
            const d = divs[k];
            if (!d?.date || d?.amount == null) continue;
            divEvents.push({
              date: new Date(d.date).toISOString().slice(0, 10),
              amount: Number(d.amount),
            });
          }
        }

        divEvents.sort((a, b) => a.date.localeCompare(b.date));
        prices.sort((a, b) => a.date.localeCompare(b.date));

        res.set("Cache-Control", "public, max-age=3600"); // 1시간 캐시
        return res.status(200).json({
          ticker,
          start,
          end,
          firstDate: prices[0]?.date || null,
          lastDate: prices[prices.length - 1]?.date || null,
          prices,
          dividends: divEvents,
        });
      } catch (e) {
        logger.error(e);
        return res.status(500).json({ error: String(e) });
      }
    })
  );
