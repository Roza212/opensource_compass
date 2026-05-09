import { ArrowLeft, Compass, Cpu, Database, Network } from 'lucide-react';

export default function AboutView({ onBack }) {
  return (
    <div className="landing-container" style={{ justifyContent: 'flex-start', paddingTop: '4rem', overflowY: 'auto' }}>
      <button 
        onClick={onBack}
        style={{
          position: 'absolute',
          top: '2rem',
          left: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '1rem',
          transition: 'color 0.3s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-blue)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <ArrowLeft size={20} /> Back
      </button>

      <Compass size={48} strokeWidth={1.5} style={{ color: '#8b5cf6', marginBottom: '1rem', position: 'relative', zIndex: 1 }} />
      <h1 className="landing-logo" style={{ fontSize: '2.5rem' }}>About OpenSource Compass</h1>
      
      <div style={{ maxWidth: '800px', width: '100%', position: 'relative', zIndex: 1, marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
        
        <section style={{ background: 'var(--dark-surface)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--dark-border)' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass className="icon" style={{ color: 'var(--neon-blue)' }} size={24} /> The Vision
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            OpenSource Compass is an advanced, enterprise-grade AI mentorship application designed to help developers seamlessly explore, understand, and learn from open-source Python codebases. By leveraging Abstract Syntax Trees (AST) and Retrieval-Augmented Generation (RAG), it bridges the gap between complex repositories and developer comprehension.
          </p>
        </section>

        <section style={{ background: 'var(--dark-surface)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--dark-border)' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu className="icon" style={{ color: 'var(--neon-purple)' }} size={24} /> How It Works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ background: 'var(--dark-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--dark-border)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }} className="about-card">
              <Network size={32} style={{ color: 'var(--neon-cyan)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>1. Ingestion</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                We perform a shallow clone of the target repository and use Tree-sitter to semantically parse and chunk the codebase by logical boundaries (functions, classes).
              </p>
            </div>
            <div style={{ background: 'var(--dark-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--dark-border)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }} className="about-card">
              <Database size={32} style={{ color: 'var(--neon-blue)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>2. Vector Embedding</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Code chunks are passed to an AI model to generate high-dimensional vectors, which are then stored in our Supabase pgvector database for rapid similarity search.
              </p>
            </div>
            <div style={{ background: 'var(--dark-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--dark-border)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }} className="about-card">
              <Cpu size={32} style={{ color: 'var(--neon-purple)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>3. AI Mentorship</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Interact with Google Gemini 3 Flash Preview, utilizing the embedded context to get highly accurate, codebase-specific answers to your questions.
              </p>
            </div>
          </div>
        </section>

      </div>
      <style>{`
        .about-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--glow-blue);
          border-color: var(--neon-blue);
        }
      `}</style>
    </div>
  );
}
