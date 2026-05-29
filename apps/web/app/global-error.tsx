"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(props.error);
  }, [props.error]);

  return (
    <html lang="en">
      <body>
        <main className="shell dashboard-content">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <p className="dashboard-panel-eyebrow">Application error</p>
                <div className="dashboard-panel-title-row">
                  <h2>Something went wrong.</h2>
                </div>
              </div>
            </div>
            <p>
              The error was captured for review. Retry the page when you are
              ready.
            </p>
            <button type="button" onClick={props.reset}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
