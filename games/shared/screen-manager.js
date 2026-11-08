/* BAR 飲んでなくない？ shared screen manager v2.24.0
 * Handles only presentation state; game rules remain local.
 */
(() => {
  'use strict';
  if (window.GameScreens) return;
  function show(name, options = {}) {
    const { ids = ['setup', 'game', 'result'], setupId = 'setup',
      activeClass = 'on', setupDisplay = 'flex', onChange } = options;
    if (!ids.includes(name)) return false;
    const screens = ids.map(id => ({ id, element: document.getElementById(id) }));
    if (screens.some(item => !item.element)) return false;
    for (const { id, element } of screens) {
      const active = id === name;
      if (id === setupId) {
        element.style.display = active ? setupDisplay : 'none';
      } else {
        element.classList.toggle(activeClass, active);
      }
    }
    if (typeof onChange === 'function') onChange(name);
    return true;
  }
  window.GameScreens = Object.freeze({ show });
})();
