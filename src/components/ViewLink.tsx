"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

type ViewLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    href: string;
  };

export function ViewLink({ href, onClick, children, ...rest }: ViewLinkProps) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === "_blank"
    ) {
      return;
    }

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (typeof doc.startViewTransition === "function") {
      e.preventDefault();
      doc.startViewTransition(() => {
        router.push(href);
      });
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
