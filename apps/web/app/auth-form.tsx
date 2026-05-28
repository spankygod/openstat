"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Separator,
  TextField,
} from "@heroui/react";
import { useState } from "react";

import { authClient } from "../lib/auth-client";

type AuthMode = "sign-in" | "create-account";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const showcaseImage =
    mode === "create-account" ? "/assets/step1.webp" : "/assets/step2.webp";
  const showcaseCopy =
    mode === "create-account"
      ? {
          headline: [
            "See every signal, decision,",
            "and trade across your agents.",
          ],
          body: "Monitor reasoning, risk checks, orders, fills, alerts, and performance from one global control plane.",
        }
      : {
          headline: ["Everything you need,", "to explain anything you want."],
          body: "Inspect agent reasoning, risk checks, trades, fills, and alerts from one workspace.",
        };

  async function signIn(formData: FormData) {
    setError(undefined);
    setIsPending(true);

    try {
      const dashboardUrl = getDashboardUrl();
      const { error } = await authClient.signIn.email({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        rememberMe: true,
        callbackURL: dashboardUrl,
      });

      if (error) {
        setError(
          error.message ||
            "Email or password did not match an OpenStat account.",
        );
        return;
      }

      window.location.href = dashboardUrl;
    } catch {
      setError(
        "Could not reach the OpenStat API. Check that the backend is running.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function createAccount(formData: FormData) {
    setError(undefined);
    setIsPending(true);

    try {
      const dashboardUrl = getDashboardUrl();
      const firstName = String(formData.get("firstName") ?? "").trim();
      const lastName = String(formData.get("lastName") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();

      const { error } = await authClient.signUp.email({
        name: [firstName, lastName].filter(Boolean).join(" "),
        email,
        password: String(formData.get("password") ?? ""),
        callbackURL: dashboardUrl,
      });

      if (error) {
        setError(
          error.message ||
            "Could not create an OpenStat account with those details.",
        );
        return;
      }

      window.location.href = dashboardUrl;
    } catch {
      setError(
        "Could not reach the OpenStat API. Check that the backend is running.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function signInGoogle() {
    setError(undefined);
    setIsPending(true);

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: getDashboardUrl(),
      });

      if (error) {
        setError(
          error.message ||
            "Google sign-in is not configured for this OpenStat backend.",
        );
        return;
      }
    } catch {
      setError(
        "Could not reach the OpenStat API. Check that the backend is running.",
      );
    } finally {
      setIsPending(false);
    }
  }

  function signInDemo() {
    setError(undefined);
    setIsPending(true);
    window.location.href = getDashboardUrl();
  }

  return (
    <main className="signin-page">
      <div className="signin-layout">
        <section className="signin-showcase" aria-hidden="true">
          <Image
            alt=""
            className="signin-showcase-image"
            fill
            priority
            sizes="(max-width: 980px) 0px, 52vw"
            src={showcaseImage}
          />
          <div className="signin-showcase-content">
            <Link className="signin-showcase-brand" href="/">
              <Image
                alt=""
                className="signin-showcase-logo"
                height={32}
                src="/assets/logo.svg"
                width={32}
              />
              <span>OpenStat</span>
            </Link>
            <div>
              <strong>
                <span>{showcaseCopy.headline[0]}</span>
                <br />
                <span>{showcaseCopy.headline[1]}</span>
              </strong>
              <p>{showcaseCopy.body}</p>
            </div>
          </div>
        </section>

        <section className="signin-panel" aria-labelledby="signin-title">
          <Link className="signin-mobile-brand" href="/">
            <Image
              alt=""
              className="signin-mobile-logo"
              height={36}
              src="/assets/logo.svg"
              width={36}
            />
            <span>OpenStat</span>
          </Link>
          <header className="signin-header">
            <h1 id="signin-title">
              {mode === "create-account"
                ? "Create an account"
                : "Welcome to OpenStat"}
            </h1>
            <p>
              {mode === "create-account"
                ? "Already have an account?"
                : "Don't have an account?"}{" "}
              <Link
                className="signin-mode-link"
                href={mode === "create-account" ? "/sign-in" : "/sign-up"}
              >
                {mode === "create-account" ? "Sign in" : "Sign up for free"}
              </Link>
            </p>
          </header>

          <Form
            className="signin-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              if (mode === "create-account") {
                void createAccount(formData);
                return;
              }

              void signIn(formData);
            }}
          >
            {mode === "create-account" ? (
              <div className="signin-name-grid">
                <TextField isRequired name="firstName" type="text">
                  <Label>First name</Label>
                  <Input
                    autoComplete="given-name"
                    fullWidth
                    placeholder="First name"
                    variant="secondary"
                  />
                  <FieldError />
                </TextField>
                <TextField isRequired name="lastName" type="text">
                  <Label>Last name</Label>
                  <Input
                    autoComplete="family-name"
                    fullWidth
                    placeholder="Last name"
                    variant="secondary"
                  />
                  <FieldError />
                </TextField>
              </div>
            ) : null}
            <TextField isRequired name="email" type="email">
              <Label>Email</Label>
              <Input
                autoComplete="email"
                fullWidth
                placeholder="Email address"
                variant="secondary"
              />
              <FieldError />
            </TextField>
            <TextField isRequired minLength={8} name="password" type="password">
              <Label>Password</Label>
              <Input
                autoComplete={
                  mode === "create-account"
                    ? "new-password"
                    : "current-password"
                }
                fullWidth
                placeholder="Password"
                variant="secondary"
              />
              <FieldError />
            </TextField>
            {mode === "sign-in" ? (
              <Link className="signin-forgot-link" href="/forgot-password">
                Forgot password?
              </Link>
            ) : null}

            {error ? <p className="signin-error">{error}</p> : null}

            <Button
              fullWidth
              isPending={isPending}
              type="submit"
              variant="primary"
            >
              {mode === "create-account" ? "Create account" : "Sign in"}
            </Button>
            <div className="signin-divider" aria-hidden="true">
              <Separator className="signin-divider-line" variant="tertiary" />
              <span>OR</span>
            </div>
            <Button
              fullWidth
              isPending={isPending}
              onPress={signInGoogle}
              type="button"
              variant="tertiary"
            >
              <GoogleMark />
              Sign in with Google
            </Button>
            <Button fullWidth isDisabled type="button" variant="tertiary">
              <GitHubMark />
              Sign in with GitHub
            </Button>
            <Button
              fullWidth
              isPending={isPending}
              onPress={signInDemo}
              type="button"
              variant="primary"
            >
              Use demo account
            </Button>
          </Form>
        </section>
      </div>
    </main>
  );
}

function getDashboardUrl() {
  return `${window.location.origin}/dashboard`;
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="signin-google-mark"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M21.805 10.023h-9.58v3.955h5.515c-.237 1.274-.958 2.354-2.042 3.08v2.56h3.305c1.934-1.782 3.047-4.407 3.047-7.514 0-.715-.064-1.405-.245-2.081z"
        fill="#4285F4"
      />
      <path
        d="M12.225 22c2.76 0 5.077-.914 6.77-2.482l-3.305-2.56c-.918.616-2.091.98-3.465.98-2.663 0-4.918-1.798-5.724-4.214H3.09v2.644C4.773 19.708 8.23 22 12.225 22z"
        fill="#34A853"
      />
      <path
        d="M6.501 13.724a5.99 5.99 0 0 1 0-3.828V7.252H3.09a10.01 10.01 0 0 0 0 9.116l3.411-2.644z"
        fill="#FBBC05"
      />
      <path
        d="M12.225 5.96c1.501 0 2.85.516 3.912 1.529l2.931-2.931C17.302 2.914 14.985 2 12.225 2 8.23 2 4.773 4.292 3.09 7.252l3.411 2.644c.806-2.416 3.061-3.936 5.724-3.936z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      className="signin-github-mark"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18a2.65 2.65 0 0 0-1.11-1.47c-.91-.62.07-.61.07-.61a2.1 2.1 0 0 1 1.53 1.03 2.13 2.13 0 0 0 2.91.83 2.14 2.14 0 0 1 .63-1.34c-2.22-.25-4.56-1.11-4.56-4.94a3.87 3.87 0 0 1 1.03-2.68 3.6 3.6 0 0 1 .1-2.64s.84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02a3.6 3.6 0 0 1 .1 2.64 3.87 3.87 0 0 1 1.03 2.68c0 3.84-2.34 4.69-4.57 4.93a2.39 2.39 0 0 1 .68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
