import { redirect } from "next/navigation";

/** Legacy `/pricing` URL — homepage holds subscription CTAs for guests. */
export default function PricingPage() {
  redirect("/");
}
