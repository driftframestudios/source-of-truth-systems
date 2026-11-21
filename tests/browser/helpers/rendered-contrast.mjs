/** Browser-computed solid/translucent paint pairs; gradients and images need visual inspection. */
export async function renderedTextPairs(scope) {
  return scope.evaluate(root => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const rgba = color => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      const bytes = [...ctx.getImageData(0, 0, 1, 1).data];
      return [...bytes.slice(0, 3), bytes[3] / 255];
    };
    const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const luminance = rgb => rgb.slice(0, 3).map(v => v / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return [...root.querySelectorAll('*')].filter(el => {
      if (!el.getClientRects().length || el.closest(':disabled') || getComputedStyle(el).visibility === 'hidden') return false;
      return [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()) || el.matches('input[type="text"], input:not([type]), select');
    }).map(el => {
      const parents = []; let parent = el;
      while (parent) { parents.unshift(parent); parent = parent.parentElement; }
      let background = [255, 255, 255]; let opacity = 1;
      for (const p of parents) {
        const style = getComputedStyle(p);
        background = over(rgba(style.backgroundColor), background);
        opacity *= Number(style.opacity);
      }
      const fg = rgba(getComputedStyle(el).color); fg[3] *= opacity;
      const foreground = over(fg, background);
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a,b)=>b-a);
      return {label:(el.value || el.textContent).trim().slice(0,70), ratio:(light+.05)/(dark+.05)};
    });
  });
}
