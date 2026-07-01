import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AccountPage from "./pages/AccountPage";
import BookPage from "./pages/BookPage";
import DictionaryPage from "./pages/DictionaryPage";
import FlashPage from "./pages/FlashPage";
import HomePage from "./pages/HomePage";
import ScanPage from "./pages/ScanPage";
import StatsPage from "./pages/StatsPage";
import "./index.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/flash" element={<FlashPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
