import { useState, useEffect } from 'react';
import { Home, Users, Calculator, CalendarDays, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';

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
  const [utilisateurs, setUtilisateurs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUtilisateurs() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('code_utilisateurs')
          .select('*');
        
        if (error) throw error;
        setUtilisateurs(data || []);
      } catch (err: any) {
        setError(err.message || 'Erreur de récupération');
      } finally {
        setLoading(false);
      }
    }
    fetchUtilisateurs();
  }, []);

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

      {/* Liste des codes utilisateurs (Supabase) */}
      <div className="card" style={{ marginTop: '16px', borderLeft: '4px solid var(--primary)' }}>
        <div className="card-title">
          <Users size={16} style={{ color: 'var(--primary)' }} />
          <span>Codes Utilisateurs (Supabase)</span>
        </div>
        
        {loading && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Chargement en cours...</p>
        )}
        
        {error && (
          <p style={{ fontSize: '13px', color: 'var(--danger)' }}>
            ⚠️ Connexion requise : Renseignez vos identifiants Supabase dans le fichier .env
          </p>
        )}
        
        {!loading && !error && utilisateurs.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Aucun code utilisateur trouvé.</p>
        )}
        
        {!loading && utilisateurs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {utilisateurs.map((u, idx) => (
              <div 
                key={u.id || idx} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 12px', 
                  backgroundColor: 'var(--input-bg)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {u.nom || u.username || u.code || `Utilisateur #${idx + 1}`}
                  </span>
                  {u.role && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Rôle : {u.role}
                    </span>
                  )}
                </div>
                {u.code && (
                  <span style={{ fontWeight: 'bold', color: 'var(--secondary)', backgroundColor: 'var(--primary-light)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                    {u.code}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
