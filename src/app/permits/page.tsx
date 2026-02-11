import { redirect } from "next/navigation";
import { DEFAULT_TOWN_ID } from "@/lib/towns";

export default function LegacyPermitsRedirect() {
  redirect(`/${DEFAULT_TOWN_ID}/permits`);
}
