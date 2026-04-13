import welfareBoardLogoUrl from "../assets/w-logo.png";

export default function SiteHeader() {
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
      </div>
    </header>
  );
}
