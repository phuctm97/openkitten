import type { AuthConfig } from "@better-auth-ui/react";
import type { ComponentProps } from "react";
import { Link } from "react-router";

type AuthLinkProps = ComponentProps<AuthConfig["Link"]>;

export function AuthLink({ children, className, to, href }: AuthLinkProps) {
  return (
    <Link className={className} to={to || href}>
      {children}
    </Link>
  );
}
