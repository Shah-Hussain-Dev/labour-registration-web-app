import { NavLink, Outlet } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import { ROUTES } from "../constants/routes.js";

function BottomTabIcon({ children }) {
  return (
    <svg
      className="bottom-tab-bar__icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function tabClassName({ isActive }) {
  return `bottom-tab-bar__tab${isActive ? " bottom-tab-bar__tab--active" : ""}`;
}

export default function AppLayout({ atmId, onAtmOpen, blockingAtmModal }) {
  return (
    <div className="app-shell" inert={blockingAtmModal ? true : undefined}>
      <SiteHeader atmId={atmId} onAtmClick={onAtmOpen} />
      <main className="site-main site-main--bottom-tabs" id="main-content">
        <Outlet context={{ atmId }} />
      </main>
      <nav className="bottom-tab-bar" aria-label="Primary">
        <div className="bottom-tab-bar__inner">
          <div className="bottom-tab-bar__links">
            <NavLink to={ROUTES.registration} end className={tabClassName}>
              <BottomTabIcon>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </BottomTabIcon>
              <span className="bottom-tab-bar__label">Registration</span>
            </NavLink>
            <NavLink to={ROUTES.scanTests} className={tabClassName}>
              <BottomTabIcon>
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" />
              </BottomTabIcon>
              <span className="bottom-tab-bar__label">Scan and Test</span>
            </NavLink>
            <NavLink to={ROUTES.uploadReport} className={tabClassName}>
              <BottomTabIcon>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </BottomTabIcon>
              <span className="bottom-tab-bar__label">Upload report</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
}
