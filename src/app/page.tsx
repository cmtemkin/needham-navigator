import { redirect } from "next/navigation";
import { DEFAULT_TOWN_ID } from "@/lib/towns";

export default function RootPageRedirect() {
  redirect(`/${DEFAULT_TOWN_ID}`);
}
