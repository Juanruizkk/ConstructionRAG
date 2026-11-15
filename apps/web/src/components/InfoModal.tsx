import { useEffect, useRef, useState, type ReactNode } from 'react';

type Lang = 'en' | 'es';
interface Tab { id: string; label: Record<Lang, string>; body: Record<Lang, ReactNode> }

const TABS: Tab[] = [
  {
    id: 'about',
    label: { en: 'What is this?', es: '¿Qué es esto?' },
    body: {
      en: (
        <>
          <h3>The problem</h3>
          <p>A <strong>general contractor (GC)</strong> — the company that runs a construction project — is about to hire
            <strong> 10–15 subcontractors</strong> (the specialized firms that do parts of the job: roofing, electrical, concrete…).
            Before signing the contracts, the GC needs to know: <strong>which of these subs have a worrying safety history?</strong></p>
          <p>A sub with a bad safety record is a real risk — accidents on site, delays, legal liability, and danger to workers.
            Today that information is scattered across a government database and hard to read. This tool <strong>gathers it, scores it,
            and lets the site foreman ask about it in plain language</strong> from a phone.</p>

          <h3>Who is OSHA?</h3>
          <p><strong>OSHA</strong> = the U.S. Occupational Safety and Health Administration, the federal agency in charge of
            workplace safety. They <strong>inspect job sites</strong>, <strong>issue citations</strong> when safety rules are broken,
            and <strong>investigate serious accidents</strong>. All of that activity is recorded in a public database — which is the
            raw material this tool is built on.</p>

          <h3>What this tool does (and doesn't)</h3>
          <ul>
            <li><strong>Does:</strong> untangle company identities from messy names, add up each sub's inspections, violations and
              accidents, compute a <strong>transparent risk score</strong>, and answer questions in a chat that <strong>cites its sources</strong>.</li>
            <li><strong>Doesn't:</strong> predict the future, replace a real safety audit, or cover companies outside the loaded data.
              A sub with <strong>no record is "unknown", not "safe"</strong>.</li>
          </ul>
        </>
      ),
      es: (
        <>
          <h3>El problema</h3>
          <p>Un <strong>general contractor (GC)</strong> — la empresa que dirige una obra — está por contratar
            <strong> 10–15 subcontratistas</strong> (las empresas especializadas que hacen partes del trabajo: techos, electricidad,
            hormigón…). Antes de firmar los contratos, el GC necesita saber: <strong>¿cuáles de esos subs tienen un historial de
            seguridad preocupante?</strong></p>
          <p>Un sub con mal historial de seguridad es un riesgo real — accidentes en obra, demoras, responsabilidad legal y peligro
            para los trabajadores. Hoy esa información está dispersa en una base de datos del gobierno y es difícil de leer. Esta
            herramienta <strong>la junta, la puntúa, y deja que el capataz pregunte sobre ella en lenguaje natural</strong> desde el celular.</p>

          <h3>¿Quién es OSHA?</h3>
          <p><strong>OSHA</strong> = la agencia federal de EE.UU. de seguridad y salud laboral. Se encarga de la seguridad en el
            trabajo: <strong>inspecciona obras</strong>, <strong>emite citaciones</strong> cuando se incumplen las normas, e
            <strong> investiga accidentes graves</strong>. Toda esa actividad queda en una base de datos pública — que es la materia
            prima de esta herramienta.</p>

          <h3>Qué hace esta herramienta (y qué no)</h3>
          <ul>
            <li><strong>Hace:</strong> desenreda la identidad de las empresas a partir de nombres sucios, suma las inspecciones,
              violaciones y accidentes de cada sub, calcula un <strong>risk score transparente</strong>, y responde preguntas en un
              chat que <strong>cita sus fuentes</strong>.</li>
            <li><strong>No hace:</strong> predecir el futuro, reemplazar una auditoría de seguridad real, ni cubrir empresas fuera de
              los datos cargados. Un sub <strong>sin registro es "desconocido", no "seguro"</strong>.</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'bid',
    label: { en: 'The bid', es: 'El bid' },
    body: {
      en: (
        <>
          <h3>What's a "bid"?</h3>
          <p>A <strong>bid</strong> is a specific job the GC is quoting, together with the list of subs they plan to bring on site.
            The dashboard shows one row per sub with a risk badge, so the GC can spot the worrying ones <em>before</em> signing.</p>

          <h3>This is a simulated bid</h3>
          <p>We don't have a real GC's subcontractor list, so the demo ships with a <strong>simulated bid — "Downtown Office Tower"</strong> —
            built from <strong>real companies pulled from the OSHA data</strong>: a mix of high-risk subs, clean ones, and one that
            isn't in OSHA's records at all (to show the "no record ≠ safe" case).</p>

          <h3>What data we loaded (the scope)</h3>
          <p>OSHA's full database is enormous, so we loaded a focused slice:</p>
          <ul>
            <li><strong>Construction only</strong> — filtered by <strong>NAICS code 23</strong>. (NAICS = the North American Industry
              Classification System, the standard U.S. industry code; <strong>23 = Construction</strong>.)</li>
            <li><strong>Three states</strong> — California, Texas and New York.</li>
            <li><strong>Roughly the last 10 years.</strong></li>
          </ul>
          <p>So a sub from another state or industry simply won't appear — that's a scope choice, not a safety verdict.</p>

          <h3>What the labels mean</h3>
          <ul>
            <li><span className="pill band-HIGH">HIGH</span> ≥ 60 ·
              <span className="pill band-MEDIUM">MED</span> 25–59 ·
              <span className="pill band-LOW">LOW</span> 1–24 ·
              <span className="pill band-NONE">NONE · 0</span> inspected, no violations found.</li>
            <li><strong>History not loaded</strong> — we haven't downloaded this sub's citations yet. A 0 here means "unknown", not "clean".</li>
            <li><strong>No OSHA record ≠ safe</strong> — the sub isn't in OSHA's data; absence of a record is not evidence of safety.</li>
          </ul>
          <h3>Adding a sub &amp; loading its history</h3>
          <p>You can search a company by name and add it. What happens next depends on the match:</p>
          <ul>
            <li><strong>Matched</strong> (found in OSHA) → the app loads its violations and accidents <strong>in the background</strong>.
              The row shows <span className="badge enriching">Enriching…</span>, then its real score once it finishes.</li>
            <li><strong>Not found</strong> (not in OSHA) → there's nothing to load; it shows "No OSHA record ≠ safe".</li>
          </ul>
          <p>Loading hits OSHA's public API, which is <strong>heavily rate-limited</strong>, so enrichment is best-effort: it can take a
            while or fail, in which case the sub stays <strong>"History not loaded"</strong> (you can add it again to retry). Tap any
            row to expand its breakdown.</p>
        </>
      ),
      es: (
        <>
          <h3>¿Qué es un "bid"?</h3>
          <p>Un <strong>bid</strong> es una obra concreta que el GC está cotizando, junto con la lista de subs que piensa llevar.
            El tablero muestra una fila por sub con un badge de riesgo, para detectar los preocupantes <em>antes</em> de firmar.</p>

          <h3>Este es un bid simulado</h3>
          <p>No tenemos la lista real de subcontratistas de ningún GC, así que el demo trae un <strong>bid simulado — "Downtown Office
            Tower"</strong> — armado con <strong>empresas reales sacadas de los datos de OSHA</strong>: una mezcla de subs de alto
            riesgo, otros limpios, y uno que no está en los registros de OSHA (para mostrar el caso "no record ≠ safe").</p>

          <h3>Qué datos cargamos (el scope)</h3>
          <p>La base completa de OSHA es enorme, así que cargamos un recorte enfocado:</p>
          <ul>
            <li><strong>Solo construcción</strong> — filtrado por <strong>código NAICS 23</strong>. (NAICS = el sistema estándar de
              clasificación de industrias de EE.UU.; <strong>23 = Construcción</strong>.)</li>
            <li><strong>Tres estados</strong> — California, Texas y Nueva York.</li>
            <li><strong>Aproximadamente los últimos 10 años.</strong></li>
          </ul>
          <p>Entonces un sub de otro estado o rubro simplemente no aparece — es una decisión de scope, no un veredicto de seguridad.</p>

          <h3>Qué significan los labels</h3>
          <ul>
            <li><span className="pill band-HIGH">HIGH</span> ≥ 60 ·
              <span className="pill band-MEDIUM">MED</span> 25–59 ·
              <span className="pill band-LOW">LOW</span> 1–24 ·
              <span className="pill band-NONE">NONE · 0</span> inspeccionado, sin violaciones.</li>
            <li><strong>History not loaded</strong> — todavía no bajamos sus citaciones. Un 0 ahí significa "desconocido", no "limpio".</li>
            <li><strong>No OSHA record ≠ safe</strong> — el sub no está en los datos de OSHA; la ausencia no es prueba de seguridad.</li>
          </ul>
          <h3>Agregar un sub y cargar su historial</h3>
          <p>Podés buscar una empresa por nombre y agregarla. Lo que pasa después depende del match:</p>
          <ul>
            <li><strong>Matched</strong> (encontrada en OSHA) → la app carga sus violaciones y accidentes <strong>en background</strong>.
              La fila muestra <span className="badge enriching">Enriching…</span>, y luego su score real cuando termina.</li>
            <li><strong>Not found</strong> (no está en OSHA) → no hay nada que cargar; muestra "No OSHA record ≠ safe".</li>
          </ul>
          <p>La carga le pega a la API pública de OSHA, que está <strong>muy rate-limiteada</strong>, así que es best-effort: puede
            tardar o fallar, y en ese caso el sub queda en <strong>"History not loaded"</strong> (podés agregarlo de nuevo para
            reintentar). Tocá cualquier fila para ver su detalle.</p>
        </>
      ),
    },
  },
  {
    id: 'score',
    label: { en: 'Risk score', es: 'Risk score' },
    body: {
      en: (
        <>
          <h3>The idea</h3>
          <p>The score turns a sub's OSHA history into a single number so the GC can compare subs on a common scale. It combines
            two things: <strong>how often and how severely they're cited</strong>, and <strong>the actual harm</strong> (injuries,
            deaths) on their sites.</p>

          <h3>Part 1 — Violation severity</h3>
          <ul>
            <li>Each citation is weighted by type: <strong>willful 10</strong> (done knowingly), <strong>repeat 7</strong>,
              <strong> serious 3</strong>, other/unclassified 1. A willful citation counts as much as ten minor ones.</li>
            <li>Older citations count less — a citation's weight <strong>halves every 5 years</strong>.</li>
            <li>The total is <strong>divided by how many times the sub was inspected</strong>, so it measures "how often are they
              cited when someone looks", not just raw volume (with a floor of 3 so a 1-inspection sub isn't exaggerated).</li>
          </ul>

          <h3>Part 2 — Harm (the real damage)</h3>
          <ul>
            <li>Injuries are weighted by outcome: <strong>fatality 50</strong>, <strong>hospitalization 15</strong>, other injury 3.
              A death weighs heavily on purpose — real harm matters more than any fine.</li>
            <li>Also reduced for age, and counted <strong>×0.3 if OSHA issued no serious citation</strong> for that incident
              (it happened, but nothing serious was formally charged).</li>
          </ul>

          <h3>The final number</h3>
          <p><code>risk_raw = 10 × (severity rate) + harm</code> — uncapped, used to <strong>rank</strong> subs (so the worst don't
            tie at 100). The <strong>0–100 score</strong> you see is that value capped at 100.</p>

          <h3>Two important honesty notes</h3>
          <ul>
            <li><strong>Dollar penalties are shown but NOT scored</strong> — they'd double-count severity and depend on settlement
              negotiations.</li>
            <li>The <em>inputs</em> are real OSHA data, but the <em>weights are our transparent, tunable design, not an industry
              standard</em>. Only the willful-vs-serious ratio mirrors OSHA's ~10× legal penalty. And remember: OSHA doesn't inspect
              randomly (<strong>selection bias</strong>), and <strong>no inspections ≠ safe</strong>.</li>
          </ul>
        </>
      ),
      es: (
        <>
          <h3>La idea</h3>
          <p>El score convierte el historial de OSHA de un sub en un solo número, para que el GC pueda compararlos en una escala común.
            Combina dos cosas: <strong>qué tan seguido y qué tan grave lo citan</strong>, y <strong>el daño real</strong> (lesiones,
            muertes) en sus obras.</p>

          <h3>Parte 1 — Severidad de violaciones</h3>
          <ul>
            <li>Cada citación pesa por tipo: <strong>willful 10</strong> (a sabiendas), <strong>repeat 7</strong> (reincidente),
              <strong> serious 3</strong>, otra/sin clasificar 1. Una willful cuenta como diez menores.</li>
            <li>Las citaciones viejas cuentan menos — el peso <strong>se parte a la mitad cada 5 años</strong>.</li>
            <li>El total se <strong>divide por cuántas veces inspeccionaron al sub</strong>, así mide "qué tan seguido lo citan cuando
              lo miran", no el volumen crudo (con un piso de 3 para no exagerar a un sub con 1 sola inspección).</li>
          </ul>

          <h3>Parte 2 — Daño (el perjuicio real)</h3>
          <ul>
            <li>Las lesiones pesan por resultado: <strong>muerte 50</strong>, <strong>hospitalización 15</strong>, otra lesión 3.
              Una muerte pesa muchísimo a propósito — el daño real importa más que cualquier multa.</li>
            <li>También se reduce por antigüedad, y cuenta <strong>×0.3 si OSHA no emitió citación grave</strong> por ese incidente
              (pasó, pero no se imputó nada grave formalmente).</li>
          </ul>

          <h3>El número final</h3>
          <p><code>risk_raw = 10 × (tasa de severidad) + daño</code> — sin tope, se usa para <strong>ordenar</strong> los subs (así los
            peores no empatan en 100). El <strong>score 0–100</strong> que ves es ese valor cortado en 100.</p>

          <h3>Dos aclaraciones honestas</h3>
          <ul>
            <li><strong>Las multas se muestran pero NO puntúan</strong> — duplicarían la severidad y dependen de negociaciones de
              settlement.</li>
            <li>Los <em>inputs</em> son datos reales de OSHA, pero los <em>pesos son nuestro diseño transparente y tuneable, no un
              estándar de la industria</em>. Solo el ratio willful-vs-serious imita el ~10× del máximo legal de OSHA. Y recordá: OSHA
              no inspecciona al azar (<strong>sesgo de selección</strong>), y <strong>sin inspecciones ≠ seguro</strong>.</li>
          </ul>
        </>
      ),
    },
  },
  {
    id: 'assistant',
    label: { en: 'The assistant', es: 'El asistente' },
    body: {
      en: (
        <>
          <h3>How the chat works</h3>
          <p>The foreman asks in plain language (English or Spanish). The assistant picks the right <strong>tools</strong>, runs them,
            and answers from their results.</p>

          <h3>The golden rule</h3>
          <p><strong>Numbers come from the database, never from the AI.</strong> Counts, penalties, fatalities and scores are computed
            in SQL and returned by typed tools — the model never invents them. Semantic search is used <em>only</em> for accident
            narratives ("what happened"). Every answer <strong>cites its source</strong>.</p>

          <h3>The tools it can call</h3>
          <ul>
            <li><strong>get_bid</strong> — list the subs on this bid, with their risk.</li>
            <li><strong>search_contractor</strong> — find a company by name, with a match confidence.</li>
            <li><strong>get_contractor_summary</strong> — the full risk breakdown for one sub.</li>
            <li><strong>list_violations</strong> — the individual citations for a sub.</li>
            <li><strong>compare_contractors</strong> — rank subs by a metric (fatalities, serious, falls…).</li>
            <li><strong>search_incidents</strong> — semantic search over accident narratives (RAG).</li>
          </ul>

          <h3>About the source links</h3>
          <p>Citations link to the related OSHA inspection page. Two caveats: OSHA's site may show a security check on the first click
            (just click again), and <strong>state-plan records</strong> (public-sector employers, e.g. a town highway department)
            aren't in the federal search, so those links may not resolve.</p>
          <p className="muted">Tip: you can ask in English or Spanish — it replies in the language you use.</p>
        </>
      ),
      es: (
        <>
          <h3>Cómo funciona el chat</h3>
          <p>El capataz pregunta en lenguaje natural (español o inglés). El asistente elige las <strong>tools</strong> correctas, las
            ejecuta y responde con sus resultados.</p>

          <h3>La regla de oro</h3>
          <p><strong>Los números salen de la base, nunca del AI.</strong> Conteos, multas, fatalidades y scores se calculan en SQL y
            los devuelven tools tipadas — el modelo no los inventa. La búsqueda semántica se usa <em>solo</em> para los relatos de
            accidentes ("qué pasó"). Cada respuesta <strong>cita su fuente</strong>.</p>

          <h3>Las tools que puede llamar</h3>
          <ul>
            <li><strong>get_bid</strong> — lista los subs del bid, con su riesgo.</li>
            <li><strong>search_contractor</strong> — busca una empresa por nombre, con una confianza de match.</li>
            <li><strong>get_contractor_summary</strong> — el breakdown de riesgo completo de un sub.</li>
            <li><strong>list_violations</strong> — las citaciones individuales de un sub.</li>
            <li><strong>compare_contractors</strong> — ordena subs por una métrica (fatalidades, serias, caídas…).</li>
            <li><strong>search_incidents</strong> — búsqueda semántica sobre los relatos de accidentes (RAG).</li>
          </ul>

          <h3>Sobre los links de las fuentes</h3>
          <p>Las citas linkean a la inspección de OSHA relacionada. Dos caveats: el sitio de OSHA puede mostrar un chequeo de seguridad
            en el primer click (clickeá de nuevo), y los <strong>registros de plan estatal</strong> (empleadores públicos, ej. el
            departamento de rutas de un municipio) no están en el buscador federal, así que esos links pueden no abrir.</p>
          <p className="muted">Tip: podés preguntar en español o inglés — responde en el idioma que uses.</p>
        </>
      ),
    },
  },
];

export function InfoModal() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(TABS[0]!.id);
  const [lang, setLang] = useState<Lang>('en');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset scroll to the top whenever the tab, language, or open state changes.
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [active, lang, open]);

  const current = TABS.find((t) => t.id === active) ?? TABS[0]!;

  return (
    <>
      <button className="info-btn" onClick={() => setOpen(true)} aria-label="How it works">ⓘ How it works</button>

      {open && (
        <div className="overlay open" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="t">{lang === 'es' ? 'Sobre esta herramienta' : 'About this tool'}</span>
              <span className="row" style={{ gap: 8 }}>
                <span className="lang-toggle">
                  <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                  <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
                </span>
                <button className="x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </span>
            </div>
            <div className="tabs">
              {TABS.map((t) => (
                <button key={t.id} className={`tab ${t.id === active ? 'active' : ''}`} onClick={() => setActive(t.id)}>
                  {t.label[lang]}
                </button>
              ))}
            </div>
            <div className="modal-body" ref={bodyRef}>{current.body[lang]}</div>
          </div>
        </div>
      )}
    </>
  );
}
