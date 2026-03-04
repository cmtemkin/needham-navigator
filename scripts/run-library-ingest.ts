/**
 * One-time script to run the library-events connector and ingest events.
 * Run: npx tsx scripts/run-library-ingest.ts
 */
import { runConnectors } from "../src/lib/connectors/runner";
import "../src/lib/connectors/register-all";

async function main() {
  console.log("Running library-events connector...");
  const results = await runConnectors({ townId: "needham", sourceId: "needham:library-events", force: true });
  console.log("Results:", JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
