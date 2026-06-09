import { useState } from "react";

import TranslatorPage from "./pages/TranslatorPage";
import SayItPage from "./pages/SayItPage";
import LearningBookPage from "./pages/LearningBookPage";

type Page = "translator" | "say-it" | "learning-book";

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
        </nav>
      </header>

      {activePage === "translator" && <TranslatorPage />}
      {activePage === "say-it" && <SayItPage />}
      {activePage === "learning-book" && <LearningBookPage />}
    </div>
  );
}

export default App;
