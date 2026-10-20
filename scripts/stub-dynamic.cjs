const React = require('react');
function Placeholder(props) {
  return React.createElement('div', { 'data-stub': 'dynamic', className: props.className, style: props.style }, 'Karten-Platzhalter (Test)');
}
exports.__esModule = true;
function factory(a, b) {
  if (typeof a === 'function') return Placeholder;
  return React.createElement('div', { 'data-stub': 'image' }, 'image');
}
module.exports = { __esModule: true, default: factory };
