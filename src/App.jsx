import React from 'react'

const DEMO_URL = import.meta.env.VITE_DEMO_URL || 'http://localhost:5173'

// SVGs inline (sem arquivos externos)
const Logo = () => (
  <span className="logo" aria-hidden="true"></span>
)

const PartnersBar = () => (
  <section aria-labelledby="trust" style={{maxWidth:"1120px", margin:"12px auto", padding:"0 8px"}}>
    <div className="card" role="region" aria-label="Prova social">
      <h3 id="trust" style={{marginBottom:8}}>Confiado por líderes do setor</h3>
      <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
        <img alt="RailCorp" height="28" loading="lazy"
             src={'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg width="160" height="36" xmlns="http://www.w3.org/2000/svg"><rect rx="6" width="160" height="36" fill="#0f172a"/><text x="80" y="23" text-anchor="middle" font-family="Inter,Arial" font-size="16" fill="#60a5fa">RailCorp</text></svg>`)} />
        <img alt="Ferrovia Brasil" height="28" loading="lazy"
             src={'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg width="180" height="36" xmlns="http://www.w3.org/2000/svg"><rect rx="6" width="180" height="36" fill="#0f172a"/><text x="90" y="23" text-anchor="middle" font-family="Inter,Arial" font-size="16" fill="#93c5fd">Ferrovia Brasil</text></svg>`)} />
        <img alt="InovaTrilhos" height="28" loading="lazy"
             src={'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg width="180" height="36" xmlns="http://www.w3.org/2000/svg"><rect rx="6" width="180" height="36" fill="#0f172a"/><text x="90" y="23" text-anchor="middle" font-family="Inter,Arial" font-size="16" fill="#60a5fa">InovaTrilhos</text></svg>`)} />
      </div>
    </div>
  </section>
)

const DemoImage = () => (
  <img
    alt="Exemplo de gráficos do RailSight"
    loading="lazy"
    width="100%"
    height="auto"
    style={{borderRadius:12, border:"1px solid #e5e7eb"}}
    src={'data:image/svg+xml;utf8,'+encodeURIComponent(`
      <svg width="1200" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="600" fill="#ffffff"/>
        <g transform="translate(60,40)">
          <rect x="0" y="0" width="1080" height="160" fill="#fbfdff" stroke="#e5e7eb"/>
          <text x="12" y="24" font-family="Inter,Arial" font-size="18" fill="#374151">Curvatura (°)</text>
          <line x1="20" y1="120" x2="1060" y2="120" stroke="#c7d2fe" stroke-width="2"/>
          <line x1="20" y1="60" x2="1060" y2="60" stroke="#e5e7eb" stroke-width="1"/>
          <polyline fill="none" stroke="#2563eb" stroke-width="3"
            points="20,90 70,70 120,100 170,60 220,110 270,85 320,60 370,95 420,60 470,105 520,80 570,60 620,90 670,60 720,100 770,65 820,110 870,85 920,60 970,95 1020,70"/>
        </g>
        <g transform="translate(60,240)">
          <rect x="0" y="0" width="1080" height="160" fill="#fbfdff" stroke="#e5e7eb"/>
          <text x="12" y="24" font-family="Inter,Arial" font-size="18" fill="#374151">Superelevação / Crosslevel (mm)</text>
          <line x1="20" y1="120" x2="1060" y2="120" stroke="#c7d2fe" stroke-width="2"/>
          <line x1="20" y1="60" x2="1060" y2="60" stroke="#e5e7eb" stroke-width="1"/>
          <polyline fill="none" stroke="#16a34a" stroke-width="3"
            points="20,80 70,90 120,70 170,100 220,80 270,110 320,70 370,95 420,85 470,65 520,105 570,75 620,95 670,70 720,110 770,80 820,95 870,70 920,100 970,85 1020,90"/>
        </g>
        <g transform="translate(60,440)">
          <rect x="0" y="0" width="1080" height="160" fill="#fbfdff" stroke="#e5e7eb"/>
          <text x="12" y="24" font-family="Inter,Arial" font-size="18" fill="#374151">Bitola / Gage (mm)</text>
          <line x1="20" y1="120" x2="1060" y2="120" stroke="#c7d2fe" stroke-width="2"/>
          <line x1="20" y1="60" x2="1060" y2="60" stroke="#e5e7eb" stroke-width="1"/>
          <polyline fill="none" stroke="#db2777" stroke-width="3"
            points="20,100 70,95 120,105 170,90 220,110 270,100 320,92 370,108 420,96 470,104 520,98 570,102 620,95 670,105 720,97 770,103 820,96 870,104 920,98 970,101 1020,99"/>
        </g>
        <rect x="220" y="560" width="760" height="28" fill="none" stroke="#9ca3af"/>
        <text x="80" y="592" font-family="Inter,Arial" font-size="16" fill="#4b5563">
          Janela 200–500 m • Andar ±100 m • Referência km 333+800 → 334+100
        </text>
      </svg>
    `)}
  />
)

export default function App(){
  return (
    <>
      <header className="header">
        <div className="brand">
          <Logo />
          <span>Data Tech RailSight</span>
        </div>
        <nav className="menu" role="navigation" aria-label="Principal">
          <a href="#solucao">Solução</a>
          <a href="#beneficios">Benefícios</a>
          <a href="#contato">Contato</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-card">
            <h1 id="hero-title">RailSight – Inteligência em Monitoramento Ferroviário</h1>
            <p>Reduza falhas, aumente a segurança e otimize custos em qualquer operação – <b>carga ou passageiros</b>.</p>
            <div className="cta">
              <a className="btn" href={DEMO_URL} target="_blank" rel="noreferrer">▶ Entrar na Demo</a>
              <a className="btn secondary" href="https://wa.me/5532991413852"
                 target="_blank" rel="noreferrer" aria-label="Agendar conversa no WhatsApp">
                 Agendar no WhatsApp
              </a>
              <a className="btn secondary" href="#solucao">Saiba mais</a>
            </div>
          </div>

          <div className="railcard card" aria-label="Resumo do que você verá">
            <h3>O que você vai ver</h3>
            <p>Painéis interativos: Curvatura, Superelevação, Bitola, Warp/Twist, Alinhamentos/Perfis e Velocidade — com navegação por janela (200–500 m) e referência de km.</p>
            <div className="rail" aria-hidden="true">
              <i></i><i></i><i></i>
            </div>
          </div>
        </section>

        <PartnersBar />

        <section id="solucao" className="points">
          <div className="card">
            <h3>Solução</h3>
            <p>Transformamos dados de via em decisões: gráficos técnicos, janelas curtas e leitura intuitiva para priorizar manutenção.</p>
          </div>
          <div className="card">
            <h3>Tecnologia</h3>
            <p>Frontend moderno (PWA), API escalável e banco otimizado para milhões de medições.</p>
          </div>
          <div className="card">
            <h3>Aplicação Geral</h3>
            <p>Serve a ferrovias de <b>carga</b> e de <b>passageiros</b>; o core é a geometria da via, a mensagem adapta ao seu negócio.</p>
          </div>
        </section>

        <section id="beneficios" style={{maxWidth:'1120px',margin:'16px auto',padding:'0 8px'}}>
          <div className="card">
            <h3>Benefícios</h3>
            <p>✔ Segurança operacional • ✔ Disponibilidade da via • ✔ Redução de custos • ✔ Acesso web e celular • ✔ Escalabilidade e integração</p>
          </div>
        </section>

        <section aria-labelledby="demo" style={{maxWidth:"1120px", margin:"16px auto", padding:"0 8px"}}>
          <div className="card">
            <h3 id="demo" style={{marginBottom:8}}>Veja na prática</h3>
            <p style={{marginTop:0, color:"#6b7280"}}>
              Curvatura, Superelevação e Bitola em janelas de 200–500 m, com referência de km e navegação por ±100 m.
            </p>
            <DemoImage />
          </div>
        </section>
      </main>

      <footer id="contato" className="footer">
        RailSight é uma solução da Data Tech – Soluções em I.A. • contato@datatech.com • WhatsApp: (32) 99141-3852
      </footer>
    </>
  )
}
