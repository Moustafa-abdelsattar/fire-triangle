const NAV = [
  ["index","Home"],["about","About"],["products","Products"],
  ["services","Services"],["projects","Projects"],["careers","Careers"],["contact","Contact"]
];
const SOCIAL = [
  ["https://www.facebook.com/firetriangleoffical/","Facebook","f"],
  ["https://linkedin.com/company/fire-triangle","LinkedIn","in"],
  ["https://wa.link/zya3z4","WhatsApp","wa"],
  ["https://www.youtube.com/@FireTriangleforengineering","YouTube","yt"]
];
export function renderChrome(active){
  const header = document.getElementById("site-header");
  if(header){
    header.innerHTML = `
    <a class="logo" href="index.html" aria-label="Fire Triangle home">
      <svg viewBox="0 0 40 36" width="34" height="30" aria-hidden="true">
        <polygon points="20,3 3,33 37,33" fill="none" stroke="#DD3333" stroke-width="3"/>
        <polygon points="20,15 13,28 27,28" fill="#DD3333"/>
      </svg>
      <span class="logo__word">FIRE&nbsp;TRIANGLE</span>
    </a>
    <nav aria-label="Primary">
      <ul class="nav">
        ${NAV.map(([k,l])=>`<li><a href="${k}.html"${k===active?' aria-current="page"':''}>${l}</a></li>`).join("")}
      </ul>
    </nav>
    <a class="btn btn--primary header__cta" href="contact.html">Request a quote</a>`;
  }
  const footer = document.getElementById("site-footer");
  if(footer){
    footer.innerHTML = `
    <div class="container footer__grid">
      <div><a class="logo logo--light" href="index.html" aria-label="Fire Triangle home">
        <span class="logo__word">FIRE TRIANGLE</span></a>
        <p class="footer__tag">Fire needs three things. We control all three.</p></div>
      <nav aria-label="Footer"><h3 class="footer__h">Site</h3><ul>
        ${NAV.slice(1).map(([k,l])=>`<li><a href="${k}.html">${l}</a></li>`).join("")}</ul></nav>
      <div><h3 class="footer__h">Find us</h3>
        <p>Head Office: 737 El-Gaish St. — Mandara, Alexandria, Egypt.</p>
        <p>Branch: 49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.</p></div>
      <div><h3 class="footer__h">Contact</h3>
        <p>Tel: +20 3 5550609 / +20 3 5527726</p>
        <p>Mobile: +20 1068 990 088</p>
        <p>Email: <a href="mailto:sales@firetriangle.net">sales@firetriangle.net</a></p>
        <ul class="social">
          ${SOCIAL.map(([u,n,a])=>`<li><a href="${u}" aria-label="${n}" class="social__${a}">${a}</a></li>`).join("")}
        </ul></div>
    </div>
    <div class="container footer__legal"><span>All rights reserved for Fire Triangle © 2026</span></div>`;
  }
}
