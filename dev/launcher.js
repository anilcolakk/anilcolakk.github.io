// Small round button on x.com that opens a menu with the two tools.
// Included in docs/x-araclari.user.js by build-web.js; TOOLS is defined there.
if (window.__xaLauncher) return;
window.__xaLauncher = true;

const tr = /^tr/i.test(navigator.language || "");
const L = tr
  ? { open: "X araçları", unfollower: "Takip etmeyenler", engagement: "Etkileşim çemberi", hide: "Düğmeyi gizle" }
  : { open: "X tools", unfollower: "Unfollowers", engagement: "Engagement circle", hide: "Hide button" };

const css = `
#xa-launch, #xa-launch * { box-sizing: border-box; }
#xa-launch { position: fixed; left: 12px; bottom: 76px; z-index: 2147483646; font: 600 14px -apple-system, "Segoe UI", Roboto, sans-serif; }
@media (min-width: 700px) { #xa-launch { bottom: 20px; } }
#xa-launch .xa-dot { width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: #16181c; color: #fff; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.35); cursor: pointer; padding: 0; }
#xa-launch .xa-menu { position: absolute; left: 0; bottom: 56px; min-width: 210px; background: #16181c; color: #e7e9ea; border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; padding: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: flex; flex-direction: column; }
#xa-launch .xa-menu[hidden] { display: none; }
#xa-launch .xa-menu button { all: unset; cursor: pointer; padding: 12px 14px; border-radius: 10px; color: #e7e9ea; font: 600 15px -apple-system, "Segoe UI", Roboto, sans-serif; }
#xa-launch .xa-menu button:hover, #xa-launch .xa-menu button:focus-visible { background: rgba(255,255,255,0.08); }
#xa-launch .xa-menu .xa-hide { color: #8b98a5; font-weight: 500; font-size: 13px; }
`;

function mountLauncher() {
  if (document.getElementById("xa-launch") || !document.body) return;
  const style = document.createElement("style");
  style.id = "xa-launch-style";
  style.textContent = css;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.id = "xa-launch";
  root.innerHTML = `
    <div class="xa-menu" role="menu" hidden>
      <button type="button" role="menuitem" data-tool="unfollower"></button>
      <button type="button" role="menuitem" data-tool="engagement"></button>
      <button type="button" role="menuitem" class="xa-hide" data-hide></button>
    </div>
    <button type="button" class="xa-dot" aria-haspopup="menu" aria-expanded="false">
      <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="none" stroke="#8b98a5" stroke-width="4" stroke-dasharray="5 6"/><circle cx="32" cy="32" r="14" fill="none" stroke="#ffd400" stroke-width="4.5"/><circle cx="32" cy="32" r="6" fill="#fff"/></svg>
    </button>`;
  const menu = root.querySelector(".xa-menu");
  const dot = root.querySelector(".xa-dot");
  dot.setAttribute("aria-label", L.open);
  dot.title = L.open;
  root.querySelector('[data-tool="unfollower"]').textContent = L.unfollower;
  root.querySelector('[data-tool="engagement"]').textContent = L.engagement;
  root.querySelector("[data-hide]").textContent = L.hide;
  const setOpen = (open) => {
    menu.hidden = !open;
    dot.setAttribute("aria-expanded", String(open));
  };
  dot.addEventListener("click", () => setOpen(menu.hidden));
  root.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => {
    setOpen(false);
    try {
      TOOLS[button.getAttribute("data-tool")]();
    } catch (error) {
      console.error("[x-araclari]", error);
      alert(String(error && error.message || error));
    }
  }));
  // Hidden until the page is reloaded.
  root.querySelector("[data-hide]").addEventListener("click", () => root.remove());
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !root.contains(event.target)) setOpen(false);
  }, true);
  document.body.appendChild(root);
}

mountLauncher();
