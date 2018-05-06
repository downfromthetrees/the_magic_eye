'use strict';

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _reactDom = require('react-dom');

var ReactDOM = _interopRequireWildcard(_reactDom);

require('./style.css');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var App = function App() {
  return React.createElement(
    'div',
    null,
    'The Magic Eye... watches'
  );
};
ReactDOM.render(React.createElement(App, null), document.querySelector('#root'));
//# sourceMappingURL=index.js.map