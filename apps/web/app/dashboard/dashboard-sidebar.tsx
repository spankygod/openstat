"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Bot,
  CircleHelp,
  Home,
  KeyRound,
  ListTree,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Button, Chip, Drawer, Separator } from "@heroui/react";
import { useEffect, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_OPENSTAT_API_URL ?? "http://localhost:4000";

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
  { label: "Events", href: "/dashboard/events", icon: ListTree },
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

  useEffect(() => {
    function handleToggle() {
      setIsCollapsed((collapsed) => !collapsed);
    }

    window.addEventListener("dashboard-sidebar-toggle", handleToggle);

    return () => {
      window.removeEventListener("dashboard-sidebar-toggle", handleToggle);
    };
  }, []);

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

export function DashboardSidebarToggle() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  function toggleSidebar() {
    setIsCollapsed((collapsed) => !collapsed);
    window.dispatchEvent(new Event("dashboard-sidebar-toggle"));
  }

  return (
    <Button
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="dashboard-sidebar-hider"
      isIconOnly
      variant="tertiary"
      onPress={toggleSidebar}
    >
      {isCollapsed ? (
        <PanelLeftOpen aria-hidden="true" size={17} />
      ) : (
        <PanelLeftClose aria-hidden="true" size={17} />
      )}
    </Button>
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
  const [isPending, setIsPending] = useState(false);
  const Icon = props.item.icon;
  const isActive =
    props.item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(props.item.href);

  async function navigate() {
    props.onNavigate?.();

    if (props.item.href === "/api/auth/sign-out") {
      setIsPending(true);

      try {
        await fetch(`${apiUrl}${props.item.href}`, {
          method: "POST",
          credentials: "include",
        });
      } finally {
        window.location.href = "/";
      }

      return;
    }

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
      isPending={isPending}
      variant={isActive ? "secondary" : "tertiary"}
      onPress={() => {
        void navigate();
      }}
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
