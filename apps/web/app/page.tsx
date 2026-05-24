import Image from "next/image";
import Link from "next/link";
import { Link as HeroLink } from "@heroui/react";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";

import { SignInModal } from "./sign-in-modal";

export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <HeroLink className="landing-brand" href="/">
          <Image
            aria-hidden="true"
            alt=""
            className="landing-brand-logo"
            height={32}
            priority
            src="/assets/logo.svg"
            width={32}
          />
          OpenStat
        </HeroLink>
        <div className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#ingestion">Ingestion</a>
          <Link href="/dashboard">Dashboard</Link>
        </div>
        <SignInModal className="landing-nav-cta">
          <LogIn aria-hidden="true" size={15} />
          Try for free
        </SignInModal>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Know what your trading agents did and why.</h1>
          <p className="landing-hero-text">
            OpenStat turns decision-to-trade telemetry into timelines your team can inspect:
            model reasoning, risk checks, orders, fills, PnL, and alerts in one product view.
          </p>
          <div className="landing-actions">
            <SignInModal className="landing-button landing-button-primary">
              Start tracking
              <ArrowRight aria-hidden="true" size={16} />
            </SignInModal>
            <HeroLink className="landing-button landing-button-secondary" href="/dashboard">
              <LayoutDashboard aria-hidden="true" size={16} />
              View dashboard
            </HeroLink>
          </div>
        </div>
      </section>
    </main>
  );
}
