const React = require('react');
exports.__esModule = true;
exports.default = function Link(props) {
  return React.createElement('a', { href: typeof props.href === 'string' ? props.href : '#', className: props.className, onClick: props.onClick, title: props.title }, props.children);
};
module.exports = { __esModule: true, default: exports.default };
