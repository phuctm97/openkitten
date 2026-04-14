import type { PropsWithChildren } from "react";

import "./layout.css";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
