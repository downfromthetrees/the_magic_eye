var React = require('react');
var ReactDOM = require('react-dom');
import './style.css';
const App = () => {
  return <div>Hello World</div>
}
ReactDOM.render(
  <App />,
  document.querySelector('#root')
);

// class Header extends React.Component {
//     render() {
//       return (
//         <div className="header">
//           <ul>
//             <li>Home</li>
//             <li>Logout</li>
//           </ul>
//         </div>
//       );
//     }
//   }