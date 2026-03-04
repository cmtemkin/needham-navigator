/**
 * Run all enabled connectors (RSS, iCal, library events, etc.)
 * Used by the GitHub Actions content pipeline.
 */
import { runConnectors } from "../src/lib/connectors/runner";
import "../src/lib/connectors/register-all";

(async () => {
  try {
    const results = await runConnectors({ townId: "needham", force: true });
    console.log(`✓ Connectors completed: ${results.length} sources processed`);
    const totalUpserted = results.reduce((s, r) => s + r.itemsUpserted, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    console.log(`  Items upserted: ${totalUpserted}, Errors: ${totalErrors}`);
    if (totalErrors > 0) process.exit(1);
  } catch (err) {
    console.error("✗ Connector run failed:", err);
    process.exit(1);
  }
})();
