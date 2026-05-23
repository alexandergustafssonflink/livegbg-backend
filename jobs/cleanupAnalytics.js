const schedule = require("node-schedule");
const PageView = require("../models/pageView");

/**
 * Startar ett schemalagt jobb som varje dag kl 03:00 raderar
 * sidvisningar äldre än 13 månader.
 *
 * 13 månader ger möjlighet att jämföra innevarande månad mot
 * samma månad föregående år, och uppfyller GDPR:s krav på
 * lagringsminimering (data lagras inte längre än nödvändigt).
 */
function startAnalyticsCleanup() {
  schedule.scheduleJob("0 3 * * *", async () => {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 13);

      const result = await PageView.deleteMany({
        timestamp: { $lt: cutoff },
      });

      console.log(
        `[Analytics cleanup] Raderade ${result.deletedCount} sidvisningar äldre än 13 månader.`
      );
    } catch (err) {
      console.error("[Analytics cleanup] Fel vid städning:", err);
    }
  });

  console.log("[Analytics cleanup] Schemalagt jobb startat (körs dagligen 03:00).");
}

module.exports = { startAnalyticsCleanup };
