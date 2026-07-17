const lampButton = document.getElementById('lampBtn');
const locationLabel = document.getElementById('location');

function applyZoneClass() {
  const text = locationLabel?.textContent || '';
  document.body.classList.toggle('zone-residential', text.includes('RESIDENTIAL'));
  document.body.classList.toggle('zone-service', !text.includes('RESIDENTIAL'));
}

if (locationLabel) {
  new MutationObserver(applyZoneClass).observe(locationLabel, {
    childList: true,
    characterData: true,
    subtree: true
  });
  applyZoneClass();
}

if (lampButton) {
  let lampOn = true;
  const triggerLamp = event => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyF',
      key: 'f',
      bubbles: true
    }));
    window.dispatchEvent(new KeyboardEvent('keyup', {
      code: 'KeyF',
      key: 'f',
      bubbles: true
    }));
    lampOn = !lampOn;
    lampButton.textContent = lampOn ? 'LAMP' : 'LAMP OFF';
    lampButton.classList.toggle('lamp-off', !lampOn);
  };

  lampButton.onpointerdown = null;
  lampButton.addEventListener('click', triggerLamp);
  lampButton.addEventListener('touchend', triggerLamp, { passive: false });
}
