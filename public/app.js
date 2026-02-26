// Client-side validation and fetch helpers
const $ = (sel) => document.querySelector(sel);

const sumForm = $('#sumForm');
const sumResult = $('#sumResult');
const echoForm = $('#echoForm');
const echoResult = $('#echoResult');

const show = (el, msg, ok) => { el.innerHTML = `<div class="${ok? 'ok':'err'}">${msg}</div>` };

sumForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const a = sumForm.elements['a'].value.trim();
  const b = sumForm.elements['b'].value.trim();

  // client validation: required and numeric
  if (!a || !b) return show(sumResult, 'Both a and b are required', false);
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isNaN(aNum) || Number.isNaN(bNum)) return show(sumResult, 'a and b must be numbers', false);

  try {
    const res = await fetch('/api/sum', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: aNum, b: bNum })
    });
    const data = await res.json();
    if (!res.ok) show(sumResult, JSON.stringify(data), false);
    else show(sumResult, `Result: ${data.result}`, true);
  } catch (err) {
    show(sumResult, err.message || 'Network error', false);
  }
});

echoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bodyText = echoForm.elements['body'].value.trim();
  if (!bodyText) return show(echoResult, 'Body is required', false);
  let parsed;
  try { parsed = JSON.parse(bodyText); } catch (err) { return show(echoResult, 'Invalid JSON', false); }

  try {
    const res = await fetch('/api/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
    const data = await res.json();
    if (!res.ok) show(echoResult, JSON.stringify(data), false);
    else show(echoResult, JSON.stringify(data), true);
  } catch (err) {
    show(echoResult, err.message || 'Network error', false);
  }
});
