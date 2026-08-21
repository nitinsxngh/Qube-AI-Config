"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const links = [
  { href: "/rag", label: "RAG" },
  { href: "/rag/model", label: "Models" },
  { href: "/rag/dataset-category", label: "Categories" },
  { href: "/rag/language", label: "Languages" },
  { href: "/rag/functions", label: "Functions" },
  { href: "/rag/published-configs", label: "Configs" },
  { href: "/intents", label: "Intents" },
  { href: "/auth", label: "Auth" },
  { href: "/ingest", label: "Ingest" },
  { href: "/flow", label: "Flow" },
  { href: "/documentation", label: "Documentation" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/rag") return pathname === "/rag";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();

  if (pathname === "/login") return null;

  const isFlow = pathname === "/flow";

  return (
    <header className="z-20 shrink-0 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
      <div
        className={`mx-auto flex h-11 items-center justify-between gap-3 px-4 sm:px-5 ${
          isFlow ? "max-w-none" : "max-w-[1280px] sm:px-6"
        }`}
      >
        <Link href="/rag" className="flex shrink-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-[#0071e3] text-[11px] font-semibold text-white">
            C
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-[#1d1d1f]">
            Chatbot Avatar
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="flex max-w-full overflow-x-auto rounded-[2px] bg-[#f5f5f7] p-0.5">
            {links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 rounded-[2px] px-3 py-1 text-[12px] font-medium transition-all duration-200 ${
                    active
                      ? "bg-white text-[#1d1d1f] shadow-sm"
                      : "text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {!loading && user && (
            <>
              <div className="hidden text-right sm:block">
                <p className="max-w-[160px] truncate text-[12px] font-medium text-[#1d1d1f]">
                  {user.full_name || user.email}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-[#86868b]">
                  {user.role}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-[2px] px-2.5 py-1 text-[12px] font-medium text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="border-t border-black/[0.04] px-4 py-1.5 md:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-[2px] px-2.5 py-1 text-[11px] font-medium ${
                  active
                    ? "bg-[#0071e3]/10 text-[#0071e3]"
                    : "text-[#86868b]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
