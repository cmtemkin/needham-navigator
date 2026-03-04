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

    // Only fail if ALL connectors errored (total failure).
    // Partial failures (e.g., one dead RSS feed) should not block
    // the rest of the pipeline — article generation depends on
    // connector output and should still run.
    const allFailed = results.length > 0 && results.every((r) => r.errors.length > 0);
    if (allFailed) {
      console.error("✗ All connectors failed — exiting with error");
      process.exit(1);
    }
    if (totalErrors > 0) {
      console.warn(`⚠ ${totalErrors} connector error(s) — continuing (partial success)`);
    }
  } catch (err) {
    console.error("✗ Connector run failed:", err);
    process.exit(1);
  }
})();
