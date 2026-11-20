"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";

type ViewLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    href: string;
  };

export function ViewLink({ href, children, ...rest }: ViewLinkProps) {
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
