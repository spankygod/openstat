import Image from "next/image";
import Link from "next/link";
import { Link as HeroLink } from "@heroui/react";
import { ArrowRight, BookOpen, LogIn } from "lucide-react";

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
        <Link className="landing-nav-cta" href="/sign-up">
          <LogIn aria-hidden="true" size={15} />
          Try for free
        </Link>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Know what your trading agents did and why.</h1>
          <p className="landing-hero-text">
            OpenStat turns decision-to-trade telemetry into timelines your team
            can inspect: model reasoning, risk checks, orders, fills, PnL, and
            alerts in one product view.
          </p>
          <div className="landing-actions">
            <Link
              className="landing-button landing-button-primary"
              href="/sign-up"
            >
              Start tracking
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link
              className="landing-button landing-button-secondary"
              href="https://docs.openstat.online"
            >
              <BookOpen aria-hidden="true" size={16} />
              Docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
