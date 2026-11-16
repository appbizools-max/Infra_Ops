import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Building2, Box, Wrench, UserCheck, Briefcase, Network, Wallet, User, Settings, Search, Bell, Menu, X, LogOut, ChevronRight, ChevronLeft, MapPin, Shield, UserCog, Layers, DollarSign, ShoppingCart, Clipboard, ClipboardList, TrendingUp, Clock, Plus, FolderPlus, Truck, Gauge, Route, Scale } from 'lucide-react';
import sideIconImg from '../../assets/Side Icon.png';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { apiFetch, getRoleDashboardPath } from '../../lib/api';

export default function TenantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [initials, setInitials] = useState('U');
  const [profileName, setProfileName] = useState('Loading...');
  const [profileSubtext, setProfileSubtext] = useState('Premium Tenant');
  const [userType, setUserType] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [userDesignation, setUserDesignation] = useState<string | null>(null);
  const [userAllowedModules, setUserAllowedModules] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState('project-1');
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});
  const sidebarNavRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const isPathActive = (subPath: string) => {
    if (subPath.includes('?')) {
      const [path, search] = subPath.split('?');
      if (location.pathname !== path) return false;
      const subParams = new URLSearchParams(search);
      const currentParams = new URLSearchParams(location.search);
      return subParams.get('tab') === currentParams.get('tab');
    }
    return location.pathname === subPath;
  };
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [showRegModal, setShowRegModal] = useState(false);
  useEffect(() => {
    if (!loading && !currentUser) navigate('/login');
  }, [currentUser, loading, navigate]);
  useEffect(() => {
    if (currentUser) {
      const mobile = currentUser.phoneNumber || '';
      const email = currentUser.email || '';

      // Check tenant registration status with apiFetch
      apiFetch(`/api/tenant/status/${currentUser.uid}?mobile=${encodeURIComponent(mobile)}&email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(statusData => {
          if (statusData.status === 'complete') {
            setIsRegistered(true);
            setShowRegModal(false);
            return apiFetch(`/api/tenant/profile/${currentUser.uid}?mobile=${encodeURIComponent(mobile)}&email=${encodeURIComponent(email)}`);
          } else {
            setIsRegistered(false);
            if (location.pathname !== '/tenant/registration' && location.pathname !== '/tenant/dashboard') {
              setShowRegModal(true);
            } else {
              setShowRegModal(false);
            }
            throw new Error('Registration incomplete');
          }
        })
        .then(res => { if (res && res.ok) return res.json(); throw new Error('Not registered'); })
        .then(data => {
          if (data?.adminName) {
            const userInitials = data.adminName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
            setInitials(userInitials);
            setProfileName(data.adminName);
            setUserType(data.userType);
            setUserDepartment(data.department || null);
            setUserDesignation(data.designation || null);
            setUserAllowedModules(Array.isArray(data.allowedModules) ? data.allowedModules : []);
            if (data.userType === 'team_member') {
              setProfileSubtext(`${data.designation || 'Member'} · ${data.memberId || ''}`);
              // Redirect team members from generic /dashboard to their role URL
              if (location.pathname === '/tenant/dashboard') {
                const rolePath = getRoleDashboardPath(data.userType, data.department || null, data.designation || null);
                navigate(rolePath, { replace: true });
              }
            } else {
              setProfileSubtext(`Tenant Admin · ${data.memberId || ''}`);
            }
          }
        })
        .catch(() => {
          setInitials('U');
          setProfileName('Registered Tenant');
          setProfileSubtext('System Administrator');
          setUserType(null);
          setUserDepartment(null);
          setUserDesignation(null);
        });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (isRegistered === false) {
      if (location.pathname === '/tenant/dashboard' || location.pathname === '/tenant/registration') {
        setShowRegModal(false);
      } else {
        setShowRegModal(true);
      }
    }
  }, [location.pathname, isRegistered]);
  const isAdmin = userType === 'admin' || userType === null || userAllowedModules.includes('*');
  const isHR =
    userType === 'team_member' && (
      String(userDepartment).toUpperCase().includes('HR') ||
      String(userDepartment).toUpperCase().includes('HUMAN RES') ||
      String(userDesignation).toUpperCase().includes('HR') ||
      String(userDesignation).toUpperCase().includes('HUMAN RES') ||
      userAllowedModules.includes('workforce')
    );
  const isProjectManager =
    userType === 'team_member' && !isHR && (
      String(userDepartment).toUpperCase().includes('PROJECT') ||
      String(userDesignation).toUpperCase().includes('PROJECT') ||
      String(userDesignation).toUpperCase().includes('PM') ||
      (userAllowedModules.includes('projects') && userAllowedModules.includes('stockyard'))
    );
  const isAccountant =
    userType === 'team_member' && (
      String(userDepartment).toUpperCase().includes('ACCOUNT') ||
      String(userDepartment).toUpperCase().includes('FINANCE') ||
      String(userDesignation).toUpperCase().includes('ACCOUNT') ||
      String(userDesignation).toUpperCase().includes('FINANCE') ||
      userAllowedModules.includes('accounts')
    );
  const isDriverOrFms =
    userType === 'team_member' && (
      String(userDepartment).toUpperCase().includes('FMS') ||
      String(userDepartment).toUpperCase().includes('FLEET') ||
      String(userDesignation).toUpperCase().includes('DRIVER') ||
      String(userDesignation).toUpperCase().includes('OPERATOR') ||
      String(userDesignation).toUpperCase().includes('PILOT') ||
      String(userDesignation).toUpperCase().includes('FMS')
    );

  const canSeeProjects = isAdmin || isHR || isProjectManager || userAllowedModules.includes('projects');
  const canSeeOperations = !isHR && !isAccountant && (isAdmin || isProjectManager || userAllowedModules.includes('stockyard') || (!isDriverOrFms && userAllowedModules.length === 0));
  const canSeeFleet = !isHR && !isAccountant && (isAdmin || isProjectManager || userAllowedModules.includes('fleet') || (!isDriverOrFms && userAllowedModules.length === 0));

  const mainNavItems = [
    ...(isDriverOrFms ? [
      { name: 'My Vehicle & Shifts', path: '/tenant/fms-employee', icon: Truck }
    ] : []),
    { name: 'Dashboard', path: '/tenant/dashboard', icon: Home },
    ...(canSeeProjects ? [
      {
        name: 'Projects & Work sites',
        icon: Briefcase,
        isCollapsible: true,
        subItems: [
          { name: 'Projects', path: '/tenant/project-management', icon: Briefcase },
          { name: 'Work Sites', path: '/tenant/work-sites', icon: MapPin }
        ]
      }
    ] : []),
    ...(isAdmin || isHR || userAllowedModules.includes('workforce') ? [
      { name: 'Attendance Tracker', path: '/tenant/attendance-tracker', icon: UserCheck },
      { name: 'Team', path: '/tenant/team', icon: Users },
      { name: 'Divisions', path: '/tenant/divisions', icon: Network },
      { name: 'Departments', path: '/tenant/departments', icon: Building2 },
      { name: 'Roles', path: '/tenant/roles', icon: Shield },
    ] : []),
    ...(isAdmin || isAccountant || userAllowedModules.includes('accounts') ? [
      {
        name: 'Accounts & Ledgers',
        icon: Wallet,
        isCollapsible: true,
        subItems: [
          { name: 'Ledger', path: '/tenant/accounts-ledgers?tab=ledger', icon: Wallet },
          { name: 'Project Costing & Details', path: '/tenant/accounts-ledgers?tab=project-costing', icon: TrendingUp },
          { name: 'Company Expenses', path: '/tenant/accounts-ledgers?tab=company-expenses', icon: DollarSign },
          { name: 'Assets & Liabilities', path: '/tenant/accounts-ledgers?tab=assets-liabilities', icon: Layers },
          { name: 'Create Ledger', path: '/tenant/accounts-ledgers?tab=create-ledger', icon: Plus }
        ]
      }
    ] : []),
    ...((isAdmin || isHR || isProjectManager || isAccountant || userAllowedModules.includes('work_orders') || userAllowedModules.length === 0) ? [
      { name: 'Work Orders', path: '/tenant/work-orders', icon: ClipboardList }
    ] : []),
    ...(canSeeOperations ? [
      {
        name: 'Operations & Stockyard',
        icon: Route,
        isCollapsible: true,
        subItems: [
          { name: 'Operations Hub (Live Tracking)', path: '/tenant/operations', icon: Route },
          { name: 'Design New Operation', path: '/tenant/operations/new', icon: Plus },
          { name: 'Change Approvals Inbox', path: '/tenant/operations/approvals', icon: Shield },
          { name: 'Stockyard Management', path: '/tenant/stockyard', icon: Layers },
          { name: 'Operations Corridors & Sketch', path: '/tenant/operations-corridors', icon: Route },
          { name: 'Dispatch Waybills & Slips', path: '/tenant/dispatch-waybills', icon: Scale },
        ]
      }
    ] : []),
    ...(canSeeFleet ? [
      {
        name: 'Fleet & Logistics',
        icon: Truck,
        isCollapsible: true,
        subItems: [
          { name: 'Fleet Hub (Trucks & Machinery)', path: '/tenant/vehicle-master', icon: Layers },
          { name: 'Fuel, Trips & Running Logs', path: '/tenant/fleet-operations', icon: Gauge },
          { name: 'Temporary Hired Vehicles', path: '/tenant/temporary-vehicles', icon: Clock },
          { name: 'FMS Employees Portal', path: '/tenant/fms-employee', icon: UserCheck },
        ]
      }
    ] : []),
  ];
  const preferenceNavItems = [
    { name: 'Profile', path: '/tenant/profile', icon: User },
    { name: 'Settings', path: '/tenant/settings', icon: Settings },
  ];
  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem('sidebar_scroll_top', String(e.currentTarget.scrollTop));
  };

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
    if (sidebarNavRef.current) {
      sessionStorage.setItem('sidebar_scroll_top', String(sidebarNavRef.current.scrollTop));
    }
  };

  // Restore sidebar scroll position across navigation
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('sidebar_scroll_top');
    if (sidebarNavRef.current && savedScroll !== null) {
      sidebarNavRef.current.scrollTop = Number(savedScroll);
    }
  }, [location.pathname, location.search]);

  // When changing route, scroll the page main content container back to top
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Ensure Operations menu is open when on operation routes
  useEffect(() => {
    if (
      location.pathname.includes('/tenant/operations') ||
      location.pathname.includes('/tenant/stockyard') ||
      location.pathname.includes('/tenant/dispatch-waybills')
    ) {
      setOpenMenus(prev => ({ ...prev, 'Operations & Stockyard': true }));
    }
  }, [location.pathname]);

  // Ensure Fleet & Logistics menu is open and kept visible when on fleet routes
  useEffect(() => {
    if (
      location.pathname.includes('/tenant/vehicle-master') ||
      location.pathname.includes('/tenant/fleet-operations') ||
      location.pathname.includes('/tenant/temporary-vehicles') ||
      location.pathname.includes('/tenant/fms-employee')
    ) {
      setOpenMenus(prev => ({ ...prev, 'Fleet & Logistics': true }));
    }
  }, [location.pathname]);

  return (
    <div className="h-screen bg-[#F1F5F9] flex flex-col md:flex-row overflow-hidden">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className={`
        absolute md:static inset-y-0 left-0 z-50 flex flex-col h-full md:h-screen
        bg-[#0F172A] transform transition-all duration-300 ease-in-out relative
        ${isCollapsed ? 'w-[76px]' : 'w-[220px]'} shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Toggle / Minimize Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-7 bg-[#1E293B] border border-slate-700 text-slate-400 rounded-full p-1 hover:text-white hidden md:flex items-center justify-center z-50 shadow-md transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand — inside sidebar only */}
        <div className={`flex items-center justify-between pt-6 pb-5 shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
          {!isCollapsed ? (
            <div>
              <p className="text-[17px] font-black text-white tracking-tight leading-none">
                InfraOps <span className="text-[#46B351]">360</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500 mt-1">Work Simplified</p>
            </div>
          ) : (
            <div className="mt-1 flex justify-center w-full">
              <img src={sideIconImg} alt="InfraOps 360" className="w-8 h-8 object-contain" />
            </div>
          )}
          {!isCollapsed && (
            <button className="md:hidden text-slate-500 hover:text-white transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>



        <div className={`border-t border-slate-800/70 mb-3 ${isCollapsed ? 'mx-2' : 'mx-4'}`} />

        {/* Scrollable Nav */}
        <div
          ref={sidebarNavRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto min-h-0 space-y-5 pb-2"
        >
          <div>
            {!isCollapsed && <p className="px-5 pb-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-slate-600">Main Menu</p>}
            <nav className={`space-y-0.5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
              {mainNavItems.map(item => (
                <NavLink
                  key={item.name}
                  item={item}
                  isCollapsed={isCollapsed}
                  isOpen={openMenus[item.name] ?? (item.subItems ? item.subItems.some((s: any) => isPathActive(s.path)) : false)}
                  onToggle={() => toggleMenu(item.name)}
                  isPathActive={isPathActive}
                  onLinkClick={handleNavClick}
                  currentPath={location.pathname}
                />
              ))}
            </nav>
          </div>
          <div>
            <div className={`border-t border-slate-800/60 mb-4 ${isCollapsed ? 'mx-2 mb-2 mt-2' : 'mx-4'}`} />
            {!isCollapsed && <p className="px-5 pb-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-slate-600">Preferences</p>}
            <nav className={`space-y-0.5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
              {preferenceNavItems.map(item => (
                <NavLink
                  key={item.name}
                  item={item}
                  isCollapsed={isCollapsed}
                  isOpen={false}
                  onToggle={() => {}}
                  isPathActive={isPathActive}
                  onLinkClick={handleNavClick}
                  currentPath={location.pathname}
                />
              ))}
            </nav>
          </div>
        </div>

        {/* Profile + Logout */}
        <div className="shrink-0 border-t border-slate-800/60">
          <div
            className={`flex items-center py-3.5 cursor-pointer hover:bg-white/5 transition-colors ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'}`}
            onClick={() => navigate('/tenant/profile')}
            title={isCollapsed ? profileName : undefined}
          >
            <div className="h-8 w-8 rounded-lg bg-[#46B351] text-white flex items-center justify-center font-black text-xs shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-white truncate leading-tight">{profileName}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{profileSubtext}</p>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className={`w-full flex items-center py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors group border-t border-slate-800/60 ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'}`}
            title={isCollapsed ? "Log Out" : undefined}
          >
            <LogOut size={15} className="shrink-0 group-hover:text-red-400" />
            {!isCollapsed && <span className="text-[13px] font-semibold">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Right Side ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile menu trigger */}
        <div className="md:hidden p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="text-xs font-bold tracking-tight">InfraOps 360</span>
        </div>

        {/* Scrollable Page Content */}
        <main ref={mainContentRef} className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/60 p-3 sm:p-4 md:p-5 lg:p-6">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* REGISTRATION REQUIRED MODAL POPUP */}
      {showRegModal && isRegistered === false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">
              Complete Company Registration
            </h3>

            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              You are currently viewing the platform in preview mode. Please finish your 3-step company registration to create projects, manage work sites, and invite your team.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowRegModal(false);
                  navigate('/tenant/registration');
                }}
                className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                Complete Registration Now
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CollapsibleNavItemProps {
  item: any;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isPathActive: (path: string) => boolean;
  onLinkClick: () => void;
}

function CollapsibleNavItem({
  item,
  isCollapsed,
  isOpen,
  onToggle,
  isPathActive,
  onLinkClick
}: CollapsibleNavItemProps) {
  const isSubActive = item.subItems.some((sub: any) => isPathActive(sub.path));
  const Icon = item.icon;
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full group flex items-center justify-between py-2.5 rounded-lg transition-all duration-150 relative ${isSubActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
          } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
        title={isCollapsed ? item.name : undefined}
      >
        {isSubActive && <span className="absolute left-0 inset-y-2 w-0.5 bg-[#46B351] rounded-r-full" />}
        <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <Icon size={isCollapsed ? 20 : 18} className={isSubActive ? 'text-[#46B351] shrink-0' : 'text-slate-400 group-hover:text-slate-200 shrink-0 transition-colors'} />
          {!isCollapsed && (
            <span className={`text-[14px] truncate ${isSubActive ? 'font-bold text-white' : 'font-medium'}`}>
              {item.name}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <ChevronRight
            size={14}
            className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-90 text-[#46B351]' : ''}`}
          />
        )}
      </button>

      {isOpen && !isCollapsed && (
        <div className="pl-4 space-y-0.5 transition-all duration-150 pt-0.5">
          {item.subItems.map((sub: any) => {
            const isSubItemActive = isPathActive(sub.path);
            const SubIcon = sub.icon;
            return (
              <Link
                key={sub.name}
                to={sub.path}
                onClick={onLinkClick}
                className={`group flex items-center py-2 px-2.5 rounded-lg transition-all duration-150 ${isSubItemActive ? 'text-white bg-white/10 font-bold shadow-2xs' : 'text-slate-300 hover:text-white hover:bg-white/5 font-medium'
                  }`}
              >
                <SubIcon size={14} className={`mr-2.5 shrink-0 ${isSubItemActive ? 'text-[#46B351]' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span className="text-[13px] leading-snug truncate">{sub.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface NavLinkProps {
  item: any;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isPathActive: (path: string) => boolean;
  onLinkClick: () => void;
  currentPath: string;
}

function NavLink({
  item,
  isCollapsed,
  isOpen,
  onToggle,
  isPathActive,
  onLinkClick,
  currentPath
}: NavLinkProps) {
  if (item.isCollapsible) {
    return (
      <CollapsibleNavItem
        item={item}
        isCollapsed={isCollapsed}
        isOpen={isOpen}
        onToggle={onToggle}
        isPathActive={isPathActive}
        onLinkClick={onLinkClick}
      />
    );
  }
  const isActive = currentPath === item.path || (item.path === '/tenant/dashboard' && currentPath === '/tenant');
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onLinkClick}
      className={`group flex items-center justify-between py-2.5 rounded-lg transition-all duration-150 relative ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
        } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
      title={isCollapsed ? item.name : undefined}
    >
      {isActive && <span className="absolute left-0 inset-y-2 w-0.5 bg-[#46B351] rounded-r-full" />}
      <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
        <Icon size={isCollapsed ? 20 : 18} className={isActive ? 'text-[#46B351] shrink-0' : 'text-slate-400 group-hover:text-slate-200 shrink-0 transition-colors'} />
        {!isCollapsed && (
          <span className={`text-[14px] truncate ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
            {item.name}
          </span>
        )}
      </div>
      {!isCollapsed && isActive && <ChevronRight size={14} className="text-[#46B351] shrink-0" />}
    </Link>
  );
}

