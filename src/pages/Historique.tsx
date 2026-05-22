import { History, Share2, Trash2, Home } from 'lucide-react';
import type { CalculAnnuel } from '../App';

interface HistoriqueProps {
  calculsAnnuels: CalculAnnuel[];
  onDeleteCalcul: (id: string) => void;
  onShareCalcul: (calc: CalculAnnuel) => void;
  onNavigate: (tab: 'home' | 'colocs' | 'calculator' | 'history') => void;
}

export default function Historique({
  calculsAnnuels,
  onDeleteCalcul,
  onShareCalcul,
  onNavigate
}: HistoriqueProps) {
  return (
    <div className="animate-fade-in">
      {/* ========================================================
          RETOUR À L'ACCUEIL DEMANDÉ PAR L'UTILISATEUR
         ======================================================== */}
      <button
        onClick={() => onNavigate('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          padding: '0 0 16px 0',
          transition: 'color 0.2s ease'
        }}
      >
        <Home size={16} />
        <span>← Retour à l'accueil</span>
      </button>

      <div className="tab-header">
        <History size={20} />
        <span>Historique & WhatsApp</span>
      </div>

      <div className="coloc-list">
        {calculsAnnuels.length === 0 ? (
          <div className="empty-state">
            <History size={48} className="empty-icon" />
            <p className="empty-text">Aucun bilan enregistré dans l'historique.</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              Saisissez vos charges sur la rubrique 💰 <b>Calculateur</b> puis cliquez sur « Enregistrer ce bilan annuel ».
            </p>
          </div>
        ) : (
          calculsAnnuels.map((calc) => (
            <div key={calc.id} className="card history-item" style={{ marginBottom: '16px' }}>
              <div className="history-header">
                <span className="history-month" style={{ textTransform: 'uppercase', fontWeight: 700 }}>Bilan {calc.annee}</span>
                <span className="history-total" style={{ fontWeight: 800, color: 'var(--primary)' }}>{calc.montantGlobalAnnuel.toFixed(2)} €</span>
              </div>
              
              <div className="history-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 12px 0' }}>
                <span>{calc.titre}</span>
                <span>Calculé le {calc.dateCalcul}</span>
              </div>

              <div className="history-shares" style={{ backgroundColor: 'var(--input-bg)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                  BILAN CUMULÉ DU PAR COLOCATAIRE :
                </span>
                {calc.cumulsAnnuels.map((p, idx) => (
                  <div key={idx} className="history-share-line" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                    <span>{p.nomComplet} ({p.totalJoursPresence}j)</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.totalDu.toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '13px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => onShareCalcul(calc)}
                >
                  <Share2 size={14} />
                  <span>Partager WhatsApp</span>
                </button>
                <button 
                  className="icon-btn icon-btn-danger" 
                  style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => onDeleteCalcul(calc.id)}
                  aria-label="Supprimer ce bilan"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
