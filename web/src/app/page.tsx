import type { Metadata } from "next";

import { LandingPage } from "@/features/marketing/landing-page";

export const metadata: Metadata = {
  title: "Gavel — Put your startup idea on trial",
  description:
    "Turn founder notes into evidence, face five AI judges, and learn what proof your startup idea needs next.",
};

export default function HomePage() {
  return <LandingPage />;
}
