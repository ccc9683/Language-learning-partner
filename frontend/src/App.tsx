import { useState } from "react";

import TranslatorPage from "./pages/TranslatorPage";
import SayItPage from "./pages/SayItPage";
import LearningBookPage from "./pages/LearningBookPage";
import PartnerPage from "./pages/PartnerPage";

type Page = "translator" | "say-it" | "learning-book" | "partner";

function App() {
  const [activePage, setActivePage] = useState<Page>("translator");

  return (
    <div className="app-shell">
      <header className="app-header">
        <nav className="app-tabs" aria-label="Primary navigation">
          <button
            className={activePage === "translator" ? "tab active" : "tab"}
            type="button"
            onClick={() => setActivePage("translator")}
          >
            Translator
          </button>
          <button
            className={activePage === "say-it" ? "tab active" : "tab"}
            type="button"
            onClick={() => setActivePage("say-it")}
          >
            Say it
          </button>
          <button
            className={activePage === "learning-book" ? "tab active" : "tab"}
            type="button"
            onClick={() => setActivePage("learning-book")}
          >
            Learning Book
          </button>
          <button
            className={activePage === "partner" ? "tab active" : "tab"}
            type="button"
            onClick={() => setActivePage("partner")}
          >
            Partner
          </button>
        </nav>
      </header>

      {activePage === "translator" && <TranslatorPage />}
      {activePage === "say-it" && <SayItPage />}
      {activePage === "learning-book" && <LearningBookPage />}
      {activePage === "partner" && <PartnerPage />}
    </div>
  );
}

export default App;
