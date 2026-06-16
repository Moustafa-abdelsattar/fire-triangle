// buildTriangle(opts) -> returns an SVG element with the fire triangle.
export function buildTriangle({size = 420, labels = ["HEAT","FUEL","OXYGEN"]} = {}){
  const s = size, pad = 56, w = s, h = s * 0.9;
  const pts = [ [w/2, pad], [pad, h-pad], [w-pad, h-pad] ];
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS,"svg");
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
  svg.setAttribute("class","ftri");
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","The fire triangle: heat, fuel, oxygen");
  const poly = document.createElementNS(svgNS,"polygon");
  poly.setAttribute("points", pts.map(p=>p.join(",")).join(" "));
  poly.setAttribute("class","ftri__poly");
  svg.appendChild(poly);
  pts.forEach((p,i)=>{
    const c = document.createElementNS(svgNS,"circle");
    c.setAttribute("cx",p[0]); c.setAttribute("cy",p[1]); c.setAttribute("r",7);
    c.setAttribute("class","ftri__vtx"); c.dataset.i = i;
    svg.appendChild(c);
    const t = document.createElementNS(svgNS,"text");
    t.setAttribute("x",p[0]); t.setAttribute("y", i===0 ? p[1]-16 : p[1]+28);
    t.setAttribute("text-anchor","middle"); t.setAttribute("class","ftri__label");
    t.textContent = labels[i];
    svg.appendChild(t);
  });
  return svg;
}
