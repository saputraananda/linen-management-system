import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Menu,
  X,
  Shirt,
} from "lucide-react";

function cn(...classes) { return classes.filter(Boolean).join(" "); }

function NavItem({ to, icon: Icon, label, description, end, onClose, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
            isActive
              ? "bg-white/20 text-white"
              : "border border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold leading-none">{label}</p>
              <p className={cn(
                "mt-0.5 truncate text-xs leading-none",
                isActive ? "text-teal-100" : "text-slate-400",
              )}>
                {description}
              </p>
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ menuItems, collapsed = false, onClose, brandIcon: BrandIcon = Shirt, brandTitle = "IKM", brandSub = "PT Intersolusi Karya Mandiri" }) {
  const isGrouped = menuItems && menuItems.length > 0 && Array.isArray(menuItems[0].items);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Brand header */}
      <div className={cn(
        "flex items-center border-b border-slate-100 py-4",
        collapsed ? "justify-center px-2" : onClose ? "justify-between gap-3 px-5" : "px-5",
      )}>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 shadow-md shadow-teal-600/30">
              <BrandIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800 leading-tight">{brandTitle}</p>
              <p className="truncate text-xs text-slate-400">{brandSub}</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 shadow-md shadow-teal-600/30">
            <BrandIcon className="h-5 w-5 text-white" />
          </div>
        )}
        {onClose && (
          <button type="button" onClick={onClose}
            className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition lg:hidden"
            aria-label="Tutup sidebar">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <nav className={cn("flex-1 overflow-y-auto space-y-4 pt-4", collapsed ? "px-1.5" : "px-3")}>
        {isGrouped ? (
          menuItems.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && group.category && (
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#126776]">{group.category}</p>
              )}
              {group.items.map(item => (
                <NavItem key={item.to} {...item} onClose={onClose} collapsed={collapsed} />
              ))}
            </div>
          ))
        ) : (
          <>
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#126776]">Menu</p>
            )}
            {menuItems.map(item => (
              <NavItem key={item.to} {...item} onClose={onClose} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>
    </div>
  );
}

function ActiveMenuTitle({ menuItems }) {
  const { pathname } = useLocation();
  const isGrouped = menuItems && menuItems.length > 0 && Array.isArray(menuItems[0].items);
  const flatItems = isGrouped ? menuItems.flatMap(group => group.items) : menuItems;

  const active =
    flatItems.find(m => m.end && pathname === m.to) ??
    flatItems.find(m => !m.end && pathname.startsWith(m.to));

  const label       = active?.label       ?? "Dashboard";
  const description = active?.description ?? "";
  const Icon        = active?.icon        ?? Shirt;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 border border-teal-200 text-teal-600 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight text-slate-800">{label}</p>
        <p className="text-xs leading-tight text-slate-400">{description}</p>
      </div>
    </div>
  );
}

export default function PageLayout({ menuItems, moduleName = "Module", bgColor = "bg-slate-50", brandIcon, brandTitle, brandSub }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setCollapsed] = useState(false);
  const drawerRef = useRef(null);

  // Dropdown states and refs
  const dropdownRef = useRef(null);
  const mobileDropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  // Retrieve user details from localStorage
  const fullName = localStorage.getItem('fullName') || localStorage.getItem('username') || 'User';
  const role = localStorage.getItem('userRole');
  const profilePath = localStorage.getItem('profilePath');
  const hospitalId = localStorage.getItem('hospitalId');
  const position = localStorage.getItem('position');
  const department = localStorage.getItem('department');

  // Subtitle/role text
  let subtitle = '';
  if (role === 'valet') {
    subtitle = position || department || 'Staff IKM';
  } else if (role === 'rs') {
    subtitle = hospitalId || 'Rumah Sakit';
  } else {
    subtitle = 'Portal User';
  }

  // Profile image / logo URL
  let avatarUrl = '';
  if (role === 'valet') {
    if (profilePath) {
      if (profilePath.startsWith('http')) {
        avatarUrl = profilePath;
      } else {
        avatarUrl = `http://103.197.189.185${profilePath}`;
      }
    } else {
      avatarUrl = '/ikm.png';
    }
  } else if (role === 'rs') {
    avatarUrl = `/assets/logos/${hospitalId}.png`;
  } else {
    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0ea5e9&color=fff&bold=true`;
  }

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    // Navigate with replace to overwrite history stack and prevent back button access
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target)) {
        setMobileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`flex h-screen overflow-hidden ${bgColor}`}>
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-300 ease-in-out overflow-hidden",
        desktopCollapsed ? "w-20" : "w-64",
      )}>
        <Sidebar menuItems={menuItems} collapsed={desktopCollapsed} brandIcon={brandIcon} brandTitle={brandTitle} brandSub={brandSub} />
      </aside>

      {/* Mobile overlay */}
      <div aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer */}
      <aside ref={drawerRef} aria-label="Sidebar navigasi"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}>
        <Sidebar menuItems={menuItems} onClose={() => setMobileOpen(false)} brandIcon={brandIcon} brandTitle={brandTitle} brandSub={brandSub} />
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Desktop topbar */}
        <header className="hidden lg:flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setCollapsed(prev => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              aria-label={desktopCollapsed ? "Buka sidebar" : "Tutup sidebar"}>
              <Menu className="h-5 w-5" />
            </button>
            <ActiveMenuTitle menuItems={menuItems} />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-600">
              <div className="h-2 w-2 rounded-full bg-teal-600" />
              {moduleName}
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Profile info desktop with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition cursor-pointer focus:outline-none"
              >
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-800 leading-none">{fullName}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium leading-none">{subtitle}</p>
                </div>
                 {role === 'valet' && !profilePath ? (
                   <img
                     src="/ikm.png"
                     alt="IKM Logo"
                     className="h-8 object-contain shrink-0"
                   />
                 ) : (
                   <img
                     src={avatarUrl}
                     alt={fullName}
                     className="h-9 w-9 rounded-full object-cover border border-slate-200 bg-slate-100 shadow-sm"
                     onError={(e) => {
                       if (role === 'valet') {
                         e.target.src = '/ikm.png';
                         e.target.className = "h-8 object-contain shrink-0";
                       } else {
                         e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0ea5e9&color=fff&bold=true`;
                       }
                     }}
                   />
                 )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition font-semibold text-left cursor-pointer rounded-lg"
                  >
                    <X className="h-4 w-4" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile topbar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setMobileOpen(prev => !prev)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 active:scale-95"
              aria-label="Buka menu navigasi" aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <ActiveMenuTitle menuItems={menuItems} />
          </div>

          {/* Profile avatar mobile with Dropdown */}
          <div className="relative" ref={mobileDropdownRef}>
            <button
              type="button"
              onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
              className="focus:outline-none cursor-pointer"
            >
              {role === 'valet' && !profilePath ? (
                <img
                  src="/ikm.png"
                  alt="IKM Logo"
                  className="h-7 object-contain shrink-0"
                />
              ) : (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="h-8 w-8 rounded-full object-cover border border-slate-200 bg-slate-100 shadow-sm"
                  onError={(e) => {
                    if (role === 'valet') {
                      e.target.src = '/ikm.png';
                      e.target.className = "h-7 object-contain shrink-0";
                    } else {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0ea5e9&color=fff&bold=true`;
                    }
                  }}
                />
              )}
            </button>

            {mobileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-800 truncate">{fullName}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition font-semibold text-left cursor-pointer rounded-lg"
                >
                  <X className="h-4 w-4" />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Outlet: render child routes */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
