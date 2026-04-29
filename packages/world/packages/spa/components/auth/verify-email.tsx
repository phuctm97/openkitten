import {
  useAuth,
  useSendVerificationEmail,
  useSession,
  useSignOut,
} from "@better-auth-ui/react";
import { worldURL } from "@openkitten/world-util";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldDescription } from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/cn";
import { toastError } from "~/lib/toast-error";

export type VerifyEmailProps = {
  className?: string;
};

export function VerifyEmail({ className }: VerifyEmailProps) {
  const { localization, navigate, basePaths, viewPaths } = useAuth();
  const { data: session } = useSession();

  const { mutate: sendVerificationEmail, isPending: sendPending } =
    useSendVerificationEmail({
      onSuccess: () => toast.success(localization.auth.verificationEmailSent),
    });

  const { mutate: signOut, isPending: signOutPending } = useSignOut({
    onError: (error) => {
      toastError(error);
      navigate({
        to: `${basePaths.auth}/${viewPaths.auth.signIn}`,
        replace: true,
      });
    },
    onSuccess: () =>
      navigate({
        to: `${basePaths.auth}/${viewPaths.auth.signIn}`,
        replace: true,
      }),
  });

  const isPending = sendPending || signOutPending;
  const email = session?.user?.email;

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          {localization.auth.verifyYourEmail}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <FieldDescription>
            We sent a verification link to{" "}
            <strong className="font-medium text-foreground">
              {email ?? "your inbox"}
            </strong>
            . Click it to finish signing in.
          </FieldDescription>

          <div className="flex flex-col gap-3">
            {email ? (
              <Button
                type="button"
                onClick={() =>
                  sendVerificationEmail({
                    email,
                    callbackURL: `${worldURL}/auth-callback`,
                  })
                }
                disabled={isPending}
              >
                {sendPending ? <Spinner /> : <Mail />}
                {localization.auth.resend}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={() => signOut()}
              disabled={isPending}
            >
              {signOutPending && <Spinner />}
              Sign out
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
