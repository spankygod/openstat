"use client";

import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Separator,
  TextField,
} from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_OPENSTAT_API_URL ?? "http://localhost:4000";

type SignInModalProps = {
  children: ReactNode;
  className?: string;
};

export function SignInModal({ children, className }: SignInModalProps) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  async function signIn(formData: FormData) {
    setError(undefined);
    setIsPending(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          rememberMe: true,
        }),
      });

      if (!response.ok) {
        setError("Email or password did not match an OpenStat account.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError(
        "Could not reach the OpenStat API. Check that the backend is running.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function signInDemo() {
    setError(undefined);
    setIsPending(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/demo-login`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setError("Demo login is not available. Run the local seed first.");
        return;
      }

      window.location.href = "/dashboard";
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
      const response = await fetch(`${apiUrl}/api/auth/sign-in/social`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: `${window.location.origin}/dashboard`,
        }),
      });

      if (!response.ok) {
        setError("Google sign-in is not configured for this OpenStat backend.");
        return;
      }

      const data = (await response.json()) as {
        redirect?: boolean;
        url?: string;
      };

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError("Google sign-in did not return a redirect URL.");
    } catch {
      setError(
        "Could not reach the OpenStat API. Check that the backend is running.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Modal>
      <Button className={className} isPending={isPending}>
        {children}
      </Button>
      <Modal.Backdrop variant="blur">
        <Modal.Container>
          <Modal.Dialog className="signin-dialog dark" data-theme="dark">
            <Modal.CloseTrigger />
            <Modal.Header className="signin-header">
              <Modal.Icon>O</Modal.Icon>
              <Modal.Heading>Create an account</Modal.Heading>
              <p>
                Start tracking trading-agent decisions, risk checks, and
                outcomes.
              </p>
            </Modal.Header>
            <Modal.Body>
              <Form
                className="signin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void signIn(new FormData(event.currentTarget));
                }}
              >
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
                <TextField
                  isRequired
                  minLength={8}
                  name="password"
                  type="password"
                >
                  <Label>Password</Label>
                  <Input
                    autoComplete="current-password"
                    fullWidth
                    placeholder="Enter your password"
                    variant="secondary"
                  />
                  <FieldError />
                </TextField>

                {error ? <p className="signin-error">{error}</p> : null}

                <Button
                  fullWidth
                  isPending={isPending}
                  type="submit"
                  variant="primary"
                >
                  Sign in
                </Button>
                <div className="signin-divider" aria-hidden="true">
                  <Separator
                    className="signin-divider-line"
                    variant="tertiary"
                  />
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
                  Continue with Google
                </Button>
                <Button
                  fullWidth
                  isPending={isPending}
                  onPress={signInDemo}
                  type="button"
                  variant="secondary"
                >
                  Continue as demo account
                </Button>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
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
