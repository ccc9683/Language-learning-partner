import type { TranslateDetail } from "./types";

type TranslateDetailPanelProps = {
  detail: TranslateDetail;
  phonetic?: string | null;
};

function TranslateDetailPanel({ detail, phonetic }: TranslateDetailPanelProps) {
  const hasMeanings = detail.meanings.length > 0;
  const hasUsages = detail.usages.length > 0;
  const hasSynonyms = detail.synonyms.length > 0;
  const hasMistakes = detail.common_mistakes.length > 0;

  return (
    <section className="detail-panel">
      <div className="detail-title">
        <h2>{detail.headword}</h2>
        {detail.pos && <span>{detail.pos}</span>}
      </div>

      {phonetic && <p className="detail-phonetic">{phonetic}</p>}

      {hasMeanings && (
        <p className="detail-meanings">
          {[detail.pos, detail.meanings.join("；")].filter(Boolean).join(" ")}
        </p>
      )}

      {hasUsages && (
        <div className="detail-section">
          <h3>常见用法</h3>
          <ol>
            {detail.usages.map((usage) => (
              <li key={`${usage.pattern}-${usage.example_en}`}>
                <strong>{usage.pattern}</strong>
                <p>{usage.example_en}</p>
                <p>{usage.example_zh}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {hasSynonyms && (
        <div className="detail-section">
          <h3>近义词</h3>
          <p>{detail.synonyms.join(", ")}</p>
        </div>
      )}

      {hasMistakes && (
        <div className="detail-section">
          <h3>常见错误</h3>
          {detail.common_mistakes.map((mistake) => (
            <div className="mistake" key={`${mistake.wrong}-${mistake.correct}`}>
              <p>
                <span>不能说</span>
                {mistake.wrong}
              </p>
              <p>
                <span>应该说</span>
                {mistake.correct}
              </p>
              {mistake.note && <p>{mistake.note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default TranslateDetailPanel;
