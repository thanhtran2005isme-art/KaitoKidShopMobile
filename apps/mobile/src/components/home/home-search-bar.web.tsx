import { useRouter } from 'expo-router';
import { useState, type ChangeEvent, type FormEvent } from 'react';

const WEB_SEARCH_CSS = `
.kks-search-stage {
  width: 100%;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  position: relative;
}
.kks-poda {
  width: 100%;
  height: 70px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}
.kks-glow,
.kks-white,
.kks-border,
.kks-dark-border-bg {
  height: 100%;
  position: absolute;
  overflow: hidden;
  z-index: 0;
  border-radius: 12px;
  pointer-events: none;
}
.kks-glow {
  width: calc(100% + 40px);
  height: 70px;
  left: -20px;
  top: 0;
  filter: blur(30px);
  opacity: .4;
}
.kks-glow::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(60deg);
  position: absolute;
  width: 999px;
  height: 999px;
  background-image: conic-gradient(
    #000 0%,
    #402fb5 5%,
    #000 38%,
    #000 50%,
    #cf30aa 60%,
    #000 87%,
    #000 100%
  );
  transition: all 2s;
}
.kks-dark-border-bg {
  width: calc(100% - 2px);
  height: 65px;
  top: 2.5px;
  border-radius: 12px;
  filter: blur(3px);
}
.kks-dark-border-bg::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(82deg);
  position: absolute;
  width: 600px;
  height: 600px;
  background-image: conic-gradient(
    rgba(0,0,0,0) 0%,
    #18116a 5%,
    rgba(0,0,0,0) 10%,
    rgba(0,0,0,0) 50%,
    #6e1b60 56%,
    rgba(0,0,0,0) 60%,
    rgba(0,0,0,0) 100%
  );
  transition: all 2s;
}
.kks-white {
  width: calc(100% - 7px);
  height: 63px;
  top: 3.5px;
  border-radius: 10px;
  filter: blur(2px);
}
.kks-white::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(83deg);
  position: absolute;
  width: 600px;
  height: 600px;
  filter: brightness(1.4);
  background-image: conic-gradient(
    rgba(0,0,0,0) 0%,
    #a099d8 4%,
    rgba(0,0,0,0) 8%,
    rgba(0,0,0,0) 50%,
    #dfa2da 54%,
    rgba(0,0,0,0) 58%,
    rgba(0,0,0,0) 100%
  );
  transition: all 2s;
}
.kks-border {
  width: calc(100% - 11px);
  height: 59px;
  top: 5.5px;
  border-radius: 11px;
  filter: blur(.5px);
}
.kks-border::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(70deg);
  position: absolute;
  width: 600px;
  height: 600px;
  filter: brightness(1.3);
  background-image: conic-gradient(
    #1c191c 0%,
    #402fb5 5%,
    #1c191c 14%,
    #1c191c 50%,
    #cf30aa 60%,
    #1c191c 64%,
    #1c191c 100%
  );
  transition: all 2s;
}
.kks-poda:hover > .kks-dark-border-bg::before {
  transform: translate(-50%, -50%) rotate(-98deg);
}
.kks-poda:hover > .kks-glow::before {
  transform: translate(-50%, -50%) rotate(-120deg);
}
.kks-poda:hover > .kks-white::before {
  transform: translate(-50%, -50%) rotate(-97deg);
}
.kks-poda:hover > .kks-border::before {
  transform: translate(-50%, -50%) rotate(-110deg);
}
.kks-poda:focus-within > .kks-dark-border-bg::before {
  transform: translate(-50%, -50%) rotate(442deg);
  transition: all 4s;
}
.kks-poda:focus-within > .kks-glow::before {
  transform: translate(-50%, -50%) rotate(420deg);
  transition: all 4s;
}
.kks-poda:focus-within > .kks-white::before {
  transform: translate(-50%, -50%) rotate(443deg);
  transition: all 4s;
}
.kks-poda:focus-within > .kks-border::before {
  transform: translate(-50%, -50%) rotate(430deg);
  transition: all 4s;
}
.kks-search-main {
  width: calc(100% - 13px);
  height: 56px;
  position: relative;
  z-index: 3;
  border-radius: 10px;
}
.kks-search-input {
  box-sizing: border-box;
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 10px;
  background: #010201;
  color: white;
  padding: 0 59px;
  font-size: 18px;
  font-weight: 500;
  outline: none;
}
.kks-search-input::placeholder {
  color: #c0b9c0;
  opacity: 1;
}
.kks-input-mask {
  pointer-events: none;
  width: 100px;
  height: 20px;
  position: absolute;
  background: linear-gradient(90deg, transparent, black);
  top: 18px;
  left: 70px;
  z-index: 4;
}
.kks-search-main:focus-within > .kks-input-mask {
  display: none;
}
.kks-pink-mask {
  pointer-events: none;
  width: 30px;
  height: 20px;
  position: absolute;
  background: #cf30aa;
  top: 10px;
  left: 5px;
  filter: blur(20px);
  opacity: .8;
  transition: all 2s;
  z-index: 4;
}
.kks-search-main:hover > .kks-pink-mask {
  opacity: 0;
}
.kks-search-icon {
  position: absolute;
  left: 20px;
  top: 15px;
  width: 24px;
  height: 24px;
  z-index: 6;
  pointer-events: none;
}
.kks-filter-border {
  height: 42px;
  width: 40px;
  position: absolute;
  overflow: hidden;
  top: 7px;
  right: 7px;
  border-radius: 10px;
  z-index: 5;
  pointer-events: none;
}
.kks-filter-border::before {
  content: '';
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
  position: absolute;
  width: 600px;
  height: 600px;
  filter: brightness(1.35);
  background-image: conic-gradient(
    rgba(0,0,0,0) 0%,
    #3d3a4f 25%,
    rgba(0,0,0,0) 50%,
    #3d3a4f 75%,
    rgba(0,0,0,0) 100%
  );
  animation: kks-rotate 4s linear infinite;
}
.kks-filter-button {
  box-sizing: border-box;
  position: absolute;
  top: 8px;
  right: 8px;
  width: 38px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  isolation: isolate;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(180deg, #161329, #000, #1d1b4b);
  border: 1px solid transparent;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(64,47,181,.55);
}
.kks-filter-button:active {
  transform: scale(.96);
}
@keyframes kks-rotate {
  100% {
    transform: translate(-50%, -50%) rotate(450deg);
  }
}
`;

export function HomeSearchBar() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    router.push({ pathname: '/search', params: { q } });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

  return (
    <div className="kks-search-stage">
      <style>{WEB_SEARCH_CSS}</style>
      <div className="kks-poda">
        <div className="kks-glow" />
        <div className="kks-dark-border-bg" />
        <div className="kks-dark-border-bg" />
        <div className="kks-dark-border-bg" />
        <div className="kks-white" />
        <div className="kks-border" />

        <form className="kks-search-main" onSubmit={onSubmit}>
          <input
            aria-label="Tìm kiếm sản phẩm"
            className="kks-search-input"
            enterKeyHint="search"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            placeholder="Tìm kiếm..."
            type="text"
            value={search}
          />
          <div className="kks-input-mask" />
          <div className="kks-pink-mask" />

          <div className="kks-filter-border" />
          <button
            aria-label="Mở bộ lọc sản phẩm"
            className="kks-filter-button"
            onClick={() => router.push('/categories')}
            type="button">
            <svg preserveAspectRatio="none" height="27" width="27" viewBox="4.8 4.56 14.832 15.408" fill="none">
              <path
                d="M8.16 6.65002H15.83C16.47 6.65002 16.99 7.17002 16.99 7.81002V9.09002C16.99 9.56002 16.7 10.14 16.41 10.43L13.91 12.64C13.56 12.93 13.33 13.51 13.33 13.98V16.48C13.33 16.83 13.1 17.29 12.81 17.47L12 17.98C11.24 18.45 10.2 17.92 10.2 16.99V13.91C10.2 13.5 9.97 12.98 9.73 12.69L7.52 10.36C7.23 10.08 7 9.55002 7 9.20002V7.87002C7 7.17002 7.52 6.65002 8.16 6.65002Z"
                stroke="#d6d6e6"
                strokeWidth="1"
                strokeMiterlimit="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="kks-search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none">
              <circle stroke="url(#kks-search-gradient)" r="8" cy="11" cx="11" />
              <line stroke="url(#kks-search-line-gradient)" y2="16.65" y1="22" x2="16.65" x1="22" />
              <defs>
                <linearGradient gradientTransform="rotate(50)" id="kks-search-gradient">
                  <stop stopColor="#f8e7f8" offset="0%" />
                  <stop stopColor="#b6a9b7" offset="50%" />
                </linearGradient>
                <linearGradient id="kks-search-line-gradient">
                  <stop stopColor="#b6a9b7" offset="0%" />
                  <stop stopColor="#837484" offset="50%" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </form>
      </div>
    </div>
  );
}
