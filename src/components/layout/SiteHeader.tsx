"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, ArrowRight, Accessibility, Menu, X } from "lucide-react";
export function BrandMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path
        d="M7 27V18c0-4 7-4 7-8V5M14 10c0 4 13 4 13 10v7"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <circle cx="7" cy="29" r="3" fill="currentColor" />
      <circle cx="14" cy="5" r="3" fill="currentColor" />
      <circle cx="27" cy="29" r="3" fill="currentColor" />
    </svg>
  );
}
export function SiteHeader() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="AccessPath home">
          <BrandMark />
          <span>
            Access<span>Path</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["/explore", "Route explorer"],
            ["/routes", "Real-world routes"],
            ["/saved", "Saved routes"],
            ["/about", "How it works"],
            ["/community", "Community"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/report" className="header-report">
          Report an obstacle <ArrowUpRight size={15} />
        </Link>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button
              className="mobile-menu-trigger icon-button"
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="navigation-overlay" />
            <Dialog.Content className="navigation-drawer">
              <div className="navigation-drawer-heading">
                <Dialog.Title>Find your way.</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="icon-button" aria-label="Close navigation">
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description>
                Routes, reporting, and the information behind AccessPath.
              </Dialog.Description>
              <nav className="mobile-menu-links" aria-label="Mobile navigation">
                {[
                  ["/", "Home"],
                  ["/explore", "Route explorer"],
                  ["/routes", "Real-world routes"],
                  ["/saved", "Saved routes"],
                  ["/report", "Report an obstacle"],
                  ["/about", "How it works"],
                  ["/community", "Community & evidence"],
                  ["/accessibility", "Accessibility"],
                  ["/privacy", "Privacy"],
                ].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={path === href ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </nav>
              <p className="navigation-note">
                Synthetic campus. Transparent routing.
                <br />
                No real-world pathway survey is claimed.
              </p>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
export function SiteFooter({ realWorld = false }: { realWorld?: boolean }) {
  return (
    <footer className="site-footer page-width">
      <div>
        <Link className="brand small" href="/">
          <BrandMark />
          <span>
            Access<span>Path</span>
          </span>
        </Link>
        <p>Every route should be accessible.</p>
      </div>
      <div className="footer-links">
        <Link href="/about">
          Methodology <ArrowRight size={12} />
        </Link>
        <Link href="/accessibility">
          <Accessibility size={14} /> Accessibility
        </Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/admin">Moderator access</Link>
      </div>
      <p className="footer-note">
        A Neighborhood Hacks 2026 prototype.
        <br />
        {realWorld
          ? "Street data. Accessibility unverified."
          : "Demonstration data. No surveyed campus routes."}
      </p>
    </footer>
  );
}
