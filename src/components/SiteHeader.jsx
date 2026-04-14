import welfareBoardLogoUrl from "../assets/w-logo.png";

export default function SiteHeader({ atmId = "", onAtmClick }) {
  return (
    <header className="site-header" aria-labelledby="site-header-board-title">
      <div className="site-header__inner">
        <div className="site-header__left">
          <div className="site-header__brand-block">
            <div className="site-header__logos">
              <div className="site-header__board-mark">
                <img
                  src={welfareBoardLogoUrl}
                  alt=""
                  width={120}
                  height={120}
                  decoding="async"
                  className="site-header__logo site-header__logo--welfare"
                />
                <div className="site-header__board-texts">
                  <span className="site-header__board-name-department">
                    Department of Labour, Government Of Uttarakhand
                  </span>
                  <span className="site-header__board-name" id="site-header-board-title">
                    Building and Other Construction Workers Welfare Board
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="site-header__actions">
          <p className="atm-id-display" aria-live="polite">
            ATM ID: <strong>{atmId || "—"}</strong>
          </p>
          <button
            type="button"
            className="btn-atm-change"
            onClick={() => onAtmClick?.()}
            aria-haspopup="dialog"
            aria-label={atmId ? `Change ATM ID, current ${atmId}` : "Add ATM ID"}
          >
            {atmId ? "Update ATM" : "Add ATM"}
          </button>
        </div>
      </div>
    </header>
  );
}
