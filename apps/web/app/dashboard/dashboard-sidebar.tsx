"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Bot,
  CircleHelp,
  Home,
  KeyRound,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Button, Chip, Drawer, Separator } from "@heroui/react";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive?: boolean;
  meta?: string;
};

const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, isActive: true },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Runs", href: "/dashboard/runs", icon: Activity },
  { label: "Trades", href: "/dashboard/trades", icon: TrendingUp },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell, meta: "New" },
  { label: "API Keys", href: "/dashboard/api-keys", icon: KeyRound },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const secondaryNav: NavItem[] = [
  { label: "Help & Information", href: "/dashboard#help", icon: CircleHelp },
  { label: "Log out", href: "/api/auth/sign-out", icon: LogOut },
];

export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <aside
        className={[
          "dashboard-sidebar",
          isCollapsed ? "dashboard-sidebar-collapsed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Dashboard navigation"
      >
        <SidebarContent isCollapsed={isCollapsed} />
      </aside>

      <Button
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="dashboard-sidebar-hider"
        isIconOnly
        variant="tertiary"
        onPress={() => setIsCollapsed((collapsed) => !collapsed)}
      >
        {isCollapsed ? (
          <PanelLeftOpen aria-hidden="true" size={17} />
        ) : (
          <PanelLeftClose aria-hidden="true" size={17} />
        )}
      </Button>

      <div className="dashboard-mobile-menu">
        <Button
          aria-label="Open dashboard navigation"
          isIconOnly
          variant="secondary"
          onPress={() => setIsOpen(true)}
        >
          <Menu aria-hidden="true" size={20} />
        </Button>
      </div>

      <Drawer.Backdrop
        className="dashboard-drawer-backdrop"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        variant="opaque"
      >
        <Drawer.Content placement="left">
          <Drawer.Dialog
            aria-label="Dashboard navigation"
            className="dashboard-drawer-panel"
          >
            <Drawer.CloseTrigger />
            <Drawer.Body className="dashboard-drawer-body">
              <SidebarContent onNavigate={() => setIsOpen(false)} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}

function SidebarContent(props: {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="dashboard-sidebar-inner">
      <div>
        <div className="dashboard-profile">
          <Avatar className="dashboard-profile-avatar" size="md">
            <Avatar.Fallback>OD</Avatar.Fallback>
          </Avatar>
          <div className="dashboard-profile-copy">
            <strong>OpenStat Demo</strong>
            <span>demo@openstat.local</span>
          </div>
        </div>

        <Separator className="dashboard-sidebar-separator" variant="tertiary" />

        <nav className="dashboard-nav" aria-label="Primary navigation">
          {primaryNav.map((item) => (
            <SidebarNavButton
              key={item.label}
              isCollapsed={props.isCollapsed}
              item={item}
              onNavigate={props.onNavigate}
            />
          ))}
        </nav>
      </div>

      <nav className="dashboard-nav" aria-label="Support navigation">
        {secondaryNav.map((item) => (
          <SidebarNavButton
            key={item.label}
            isCollapsed={props.isCollapsed}
            item={item}
            onNavigate={props.onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

function SidebarNavButton(props: {
  isCollapsed?: boolean;
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const Icon = props.item.icon;
  const isActive =
    props.item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(props.item.href);

  function navigate() {
    props.onNavigate?.();

    if (props.item.href.startsWith("/api/")) {
      window.location.href = props.item.href;
      return;
    }

    router.push(props.item.href);
  }

  return (
    <Button
      aria-label={props.isCollapsed ? props.item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={[
        "dashboard-nav-item",
        isActive ? "dashboard-nav-item-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      fullWidth={!props.isCollapsed}
      isIconOnly={props.isCollapsed}
      variant={isActive ? "secondary" : "tertiary"}
      onPress={navigate}
    >
      <span className="dashboard-nav-icon-slot" aria-hidden="true">
        <Icon className="dashboard-nav-icon" size={16} />
      </span>
      <span className="dashboard-nav-label">{props.item.label}</span>
      {props.item.meta && !props.isCollapsed ? (
        <Chip color="success" size="sm" variant="soft">
          <Chip.Label>{props.item.meta}</Chip.Label>
        </Chip>
      ) : null}
    </Button>
  );
}
