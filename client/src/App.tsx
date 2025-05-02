import React from 'react';
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { RoomsListPage } from './components/RoomsListPage';
import { ChatRoomPage } from './components/ChatRoomPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoomsListPage />} />
        <Route path="/rooms/:roomId" element={<ChatRoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
