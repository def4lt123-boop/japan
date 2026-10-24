const Module = require('module');
require('react');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('src/')) req = '/home/user/japan/' + req;
  return orig.call(this, req, ...rest);
};
const nav = require('/home/user/japan/scripts/stub-navigation.cjs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/t/trip-2027/tage', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.getComputedStyle = dom.window.getComputedStyle; global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
dom.window.HTMLElement.prototype.getBoundingClientRect = function () { return { top: 10, bottom: 40, left: 10, right: 90, width: 80, height: 30, x: 10, y: 10 }; };
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react');
const { StoreProvider } = require('/home/user/japan/src/lib/store.tsx');
const { EditorProvider } = require('/home/user/japan/src/components/EditorProvider.tsx');
nav.setPath('/t/trip-2027/tage');
const Page = require('/home/user/japan/src/app/t/[tripId]/tage/page.tsx').default;
(async () => {
  const c = document.getElementById('root');
  const r = createRoot(c);
  await act(async () => { r.render(React.createElement(StoreProvider, null, React.createElement(EditorProvider, { tripId: 'trip-2027' }, React.createElement(Page)))); });
  await act(async () => { await new Promise((x) => setTimeout(x, 60)); });
  const titles = [...c.querySelectorAll('button')].map((b) => b.getAttribute('title') || '').filter((t) => /Ideen|Tag/.test(t)).slice(0, 8);
  console.log('titles:', JSON.stringify(titles));
  const btn = [...c.querySelectorAll('button')].find((b) => (b.title || '').includes('Ideen für diesen Tag'));
  console.log('btn gefunden:', Boolean(btn), btn && btn.textContent);
  if (btn) {
    await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((x) => setTimeout(x, 40)); });
    console.log('blech:', Boolean(dom.window.document.body.querySelector('[data-ideen-sheet]')), 'ideen:', dom.window.document.body.querySelectorAll('[data-idee]').length);
    console.log('body-html-ausschnitt:', dom.window.document.body.innerHTML.slice(-400));
  }
})();
