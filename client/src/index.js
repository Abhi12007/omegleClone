import React from 'react';
import ReactDOM from 'react-dom/client';
import io from 'socket.io-client';

const socket = io(); // <-- changed here

function App() {
  return (
    <div style={{textAlign:"center", marginTop:"20%"}}>
      <h1>Omegle Clone 🚀</h1>
      <p>Connected to server: {socket.id ? "Yes" : "No"}</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
