import { Home, Users, Calculator, CalendarDays, ArrowRight } from 'lucide-react';

interface CalculAnnuel {
  id: string;
  annee: number;
  titre: string;
  montantGlobalAnnuel: number;
  dateCalcul: string;
}

interface AccueilProps {
  colocatairesCount: number;
  selectedYear: number;
  latestCalculation: CalculAnnuel | null;
  onNavigate: (tab: 'home' | 'colocs' | 'calculator' | 'history') => void;
}

export default function Accueil({
  colocatairesCount,
  selectedYear,
  latestCalculation,
  onNavigate
}: AccueilProps) {
  return (
    <div className="animate-fade-in">
      <div className="tab-header">
        <Home size={20} />
        <span>Accueil</span>
      </div>

      {/* ========================================================
          LES DEUX BOUTONS MAJEURS DEMANDÉS PAR L'UTILISATEUR
         ======================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => onNavigate('colocs')}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            transition: 'transform 0.2s ease'
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%', color: 'var(--text-inverse)' }}>
              <Users size={24} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '18px', fontWeight: 700, color: 'var(--text-inverse)' }}>
                Saisie des colocataires
              </span>
              <span style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Gérer les profils et les dates de présence ({colocatairesCount} actifs)
              </span>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--text-inverse)' }} />
        </button>

        <button
          onClick={() => onNavigate('calculator')}
          className="btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--secondary), #0f766e)',
            boxShadow: '0 8px 20px rgba(13, 148, 136, 0.25)',
            color: 'var(--text-inverse)',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            transition: 'transform 0.2s ease'
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%', color: 'var(--text-inverse)' }}>
              <Calculator size={24} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '18px', fontWeight: 700, color: 'var(--text-inverse)' }}>
                Saisie des charges
              </span>
              <span style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Répartir le budget annuel au prorata ({selectedYear})
              </span>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--text-inverse)' }} />
        </button>
      </div>

      {/* Raccourci Dernier Bilan Enregistré */}
      {latestCalculation && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', marginTop: '8px' }}>
          <div className="card-title">
            <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
            <span>Dernier bilan enregistré</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                {latestCalculation.titre} ({latestCalculation.annee})
              </span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Budget : {latestCalculation.montantGlobalAnnuel.toFixed(2)} € (le {latestCalculation.dateCalcul})
              </span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', borderRadius: 'var(--radius-sm)' }}
              onClick={() => onNavigate('history')}
            >
              Consulter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
