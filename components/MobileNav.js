
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Home,
  UserRound,
} from "lucide-react";

const navigation = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Workout", href: "/workout?activity=Running", match: "/workout", Icon: Activity },
  { label: "History", href: "/history", Icon: CalendarDays },
  { label: "Profile", href: "/profile", Icon: UserRound },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        {navigation.map(({ label, href, Icon, match }) => {
          const active = pathname === (match || href);

          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition ${
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.4 : 1.8}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
