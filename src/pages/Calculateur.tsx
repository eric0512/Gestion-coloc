import { Calculator, DollarSign, Users, AlertCircle, Check, ChevronUp, ChevronDown } from 'lucide-react';
import type { Colocataire } from './Colocataires';
import type { RepartitionMensuelle, CumulAnnuelColoc } from '../App';

interface CalculateurProps {
  colocataires: Colocataire[];
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  montantGlobalAnnuel: string;
  setMontantGlobalAnnuel: (amount: string) => void;
  calculDescription: string;
  setCalculDescription: (desc: string) => void;
  currentResult: {
    repartitionsMensuelles: RepartitionMensuelle[];
    cumulsAnnuels: CumulAnnuelColoc[];
  } | null;
  onSaveCalculation: () => void;
  onNavigate: (tab: 'home' | 'colocs' | 'calculator' | 'history') => void;
  expandedMonth: number | null;
  setExpandedMonth: (month: number | null) => void;
}

export default function Calculateur({
  colocataires,
  selectedYear,
  setSelectedYear,
  montantGlobalAnnuel,
  setMontantGlobalAnnuel,
  calculDescription,
  setCalculDescription,
  currentResult,
  onSaveCalculation,
  onNavigate,
  expandedMonth,
  setExpandedMonth
}: CalculateurProps) {
  
  const totalJoursPresenceTous = currentResult 
    ? currentResult.cumulsAnnuels.reduce((sum, c) => sum + c.totalJoursPresence, 0)
    : 0;

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
        <HomeIcon size={16} />
        <span>← Retour à l'accueil</span>
      </button>

      {/* Saisie de la charge */}
      <div className="card" style={{ borderLeft: '4px solid var(--primary)', marginBottom: '20px' }}>
        <div className="card-title">
          <DollarSign size={16} style={{ color: 'var(--primary)' }} />
          <span>Saisie des Charges Annuelles</span>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Sélectionner l'année</label>
            <input 
              type="number" 
              className="input-field" 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value) || 2026)}
              placeholder="Ex: 2026"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Montant annuel global</label>
            <input 
              type="number" 
              className="input-field" 
              value={montantGlobalAnnuel}
              onChange={(e) => setMontantGlobalAnnuel(e.target.value)}
              placeholder="Ex: 7200"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Libellé de la charge</label>
          <input 
            type="text" 
            className="input-field" 
            value={calculDescription}
            onChange={(e) => setCalculDescription(e.target.value)}
            placeholder="Ex: Loyer annuel"
          />
        </div>
      </div>

      {/* Détails par mois (Accordéon) */}
      <div className="card">
        <div className="card-title">
          <Calculator size={16} />
          <span>Répartition mensuelle détaillée</span>
        </div>
        
        {colocataires.length === 0 ? (
          <div className="empty-state" style={{ padding: '8px 0' }}>
            <Users size={32} className="empty-icon" />
            <p className="empty-text">Veuillez d'abord enregistrer des colocataires.</p>
            <button className="btn btn-primary" style={{ marginTop: '12px', fontSize: '13px' }} onClick={() => onNavigate('colocs')}>
              Gérer les colocataires
            </button>
          </div>
        ) : currentResult && totalJoursPresenceTous === 0 ? (
          <div className="empty-state" style={{ padding: '8px 0', color: 'var(--danger)' }}>
            <AlertCircle size={32} className="empty-icon" style={{ color: 'var(--danger)' }} />
            <p className="empty-text">Aucun colocataire présent pour l'année {selectedYear}.</p>
            <button className="btn btn-secondary" style={{ marginTop: '12px', fontSize: '13px' }} onClick={() => onNavigate('colocs')}>
              Ajuster les dates de présence
            </button>
          </div>
        ) : (
          <>
            <p className="card-subtitle" style={{ marginBottom: '12px' }}>
              Cliquez sur un mois pour inspecter les jours-présence et le coût journalier.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentResult && currentResult.repartitionsMensuelles.map((rep) => {
                const isExpanded = expandedMonth === rep.numeroMois;
                const monthActiveColocs = rep.parts.filter(p => p.joursPresence > 0);
                
                return (
                  <div 
                    key={rep.numeroMois} 
                    style={{ 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={() => setExpandedMonth(isExpanded ? null : rep.numeroMois)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>
                          {rep.nomMois} {selectedYear}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {monthActiveColocs.length} colocataire(s) présent(s)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--secondary)' }}>
                          {rep.totalJoursColocs > 0 ? `${rep.montantGlobalMois.toFixed(2)} €` : '0.00 €'}
                        </span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ 
                        padding: '12px 16px', 
                        borderTop: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-phone)'
                      }}>
                        {rep.totalJoursColocs === 0 ? (
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
                            Aucun colocataire actif pour ce mois de {rep.nomMois}.
                          </p>
                        ) : (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Total jours-colocs : {rep.totalJoursColocs}j</span>
                              <span>Journalier : {rep.tauxJournalier.toFixed(2)} € / jour</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {rep.parts.map(part => {
                                const isPresent = part.joursPresence > 0;
                                return (
                                  <div 
                                    key={part.colocId} 
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '8px 0',
                                      fontSize: '13px',
                                      borderBottom: '1px dashed var(--border-color)',
                                      opacity: isPresent ? 1 : 0.4
                                    }}
                                  >
                                    <span>{part.nomComplet}</span>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontWeight: 700, color: isPresent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        {part.montantDu.toFixed(2)} €
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                        {part.joursPresence} jours / {rep.daysInMonth} présents
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {currentResult && totalJoursPresenceTous > 0 && (
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '20px' }}
                onClick={onSaveCalculation}
              >
                <Check size={18} />
                <span>Enregistrer ce bilan annuel</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Simple Home Icon locally in the file to avoid importing too many icons
function HomeIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

