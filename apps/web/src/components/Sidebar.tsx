"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  CreditCard,
  Users,
  Shield,
  Settings,
  Database,
  HelpCircle,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Profil", href: "/profile", icon: User },
  { name: "Mitgliedschaft", href: "/membership", icon: CreditCard },
  { name: "Team", href: "/team", icon: Users },
  { name: "Sicherheit", href: "/security", icon: Shield },
  { name: "Einstellungen", href: "/preferences", icon: Settings },
  { name: "Daten & Privatsphäre", href: "/data", icon: Database },
  { name: "Hilfe", href: "/support", icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo & Brand */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">MOJO Accounts</h1>
            <p className="text-xs text-muted-foreground">Account Portal</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "sidebar-link",
                isActive && "active"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default Sidebar;
