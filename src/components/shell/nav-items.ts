import {
  BookOpen,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  ScanBarcode,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/diary", label: "Food Diary", short: "Diary", icon: BookOpen, mobile: true },
  { href: "/foods", label: "Food Search", short: "Search", icon: Search, mobile: true },
  { href: "/scan", label: "Scan Barcode", short: "Scan", icon: ScanBarcode, mobile: true },
  { href: "/nutrients", label: "Nutrients", icon: FlaskConical, mobile: true },
  { href: "/insights", label: "Insights", icon: Lightbulb, mobile: false },
  { href: "/history", label: "History", icon: CalendarDays, mobile: false },
  { href: "/settings", label: "Settings", icon: Settings, mobile: false },
  // Only a link: access is checked on the server for every admin page and action.
  { href: "/admin", label: "Admin", icon: ShieldCheck, mobile: false },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
