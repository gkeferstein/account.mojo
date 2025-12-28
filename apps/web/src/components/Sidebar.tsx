"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import {
  Home,
  User,
  CreditCard,
  Users,
  Shield,
  Settings,
  Database,
  HelpCircle,
  Menu,
  X,
  ChevronDown,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/TenantProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getRoleDisplayName } from "@/lib/utils";

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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTenantSwitcherOpen, setIsTenantSwitcherOpen] = useState(false);
  const { user, tenants, activeTenant, switchTenant } = useTenant();

  const handleTenantSwitch = async (tenantId: string) => {
    try {
      await switchTenant(tenantId);
      setIsTenantSwitcherOpen(false);
    } catch (error) {
      console.error("Failed to switch tenant:", error);
    }
  };

  const sidebarContent = (
    <>
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

      {/* Tenant Switcher */}
      {activeTenant && tenants.length > 1 && (
        <div className="p-4 border-b border-border">
          <button
            onClick={() => setIsTenantSwitcherOpen(!isTenantSwitcherOpen)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {activeTenant.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium truncate">{activeTenant.name}</p>
              <p className="text-xs text-muted-foreground">
                {getRoleDisplayName(activeTenant.role)}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                isTenantSwitcherOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {isTenantSwitcherOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSwitch(tenant.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                        tenant.id === activeTenant.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-secondary/50 text-muted-foreground"
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {tenant.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{tenant.name}</span>
                      {tenant.isPersonal && (
                        <span className="ml-auto text-xs bg-secondary px-1.5 py-0.5 rounded">
                          Persönlich
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
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

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-10 h-10",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X /> : <Menu />}
      </Button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-background/95 backdrop-blur-md border-r border-border flex flex-col z-40 transition-transform duration-300 lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Spacer */}
      <div className="hidden lg:block w-72 shrink-0" />
    </>
  );
}

export default Sidebar;


