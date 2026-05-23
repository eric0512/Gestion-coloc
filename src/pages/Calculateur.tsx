import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Users, AlertCircle, Check, ChevronUp, ChevronDown, Flame, Zap, Wifi, Trash2, X, Home } from 'lucide-react';
import type { Colocataire } from './Colocataires';
import type { RepartitionMensuelle, CumulAnnuelColoc } from '../App';

interface PeriodeCharge {
  id: string;
  dateDebut: string;
  dateFin: string;
  montant: number;
}

interface ChargesDetaillees {
  gaz: PeriodeCharge[];
  electricite: PeriodeCharge[];
  autres: PeriodeCharge[];
  communes: PeriodeCharge[];
}

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
  currentResult,
  onSaveCalculation,
  onNavigate,
  expandedMonth,
  setExpandedMonth
}: CalculateurProps) {
  
  // --- État des charges détaillées ---
  const [chargesDetaillees, setChargesDetaillees] = useState<ChargesDetaillees>(() => {
    const saved = localStorage.getItem('coloc_charges_detaillees');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      gaz: [],
      electricite: [],
      autres: [],
      communes: []
    };
  });

  // --- États Modals ---
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'gaz' | 'electricite' | 'autres' | 'communes' | ''>('');

  // --- États Formulaire de Période ---
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newPeriodAmount, setNewPeriodAmount] = useState('');
  const [periodError, setPeriodError] = useState('');

  // --- Calculer et synchroniser le montant global ---
  useEffect(() => {
    localStorage.setItem('coloc_charges_detaillees', JSON.stringify(chargesDetaillees));
    const total = [...chargesDetaillees.gaz, ...chargesDetaillees.electricite, ...chargesDetaillees.autres, ...chargesDetaillees.communes]
      .reduce((sum, p) => sum + p.montant, 0);
    setMontantGlobalAnnuel(total.toFixed(2));
  }, [chargesDetaillees, setMontantGlobalAnnuel]);

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value as 'gaz' | 'electricite' | 'autres' | 'communes' | '';
    if (cat) {
      setSelectedCategory(cat);
      setShowChargeModal(true);
      e.target.value = ''; // Reset select
    }
  };

  const handleAddPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriodError('');

    if (!newPeriodStart || !newPeriodEnd || !newPeriodAmount) {
      setPeriodError('Veuillez remplir tous les champs de la période.');
      return;
    }

    if (newPeriodEnd < newPeriodStart) {
      setPeriodError('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    const amt = parseFloat(newPeriodAmount);
    if (isNaN(amt) || amt <= 0) {
      setPeriodError('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    if (!selectedCategory) return;

    const newPeriod: PeriodeCharge = {
      id: `period-${Date.now()}`,
      dateDebut: newPeriodStart,
      dateFin: newPeriodEnd,
      montant: amt
    };

    setChargesDetaillees(prev => ({
      ...prev,
      [selectedCategory]: [...prev[selectedCategory], newPeriod]
    }));

    // Réinitialiser les champs
    setNewPeriodStart('');
    setNewPeriodEnd('');
    setNewPeriodAmount('');
  };

  const handleDeletePeriod = (id: string) => {
    if (!selectedCategory) return;
    setChargesDetaillees(prev => ({
      ...prev,
      [selectedCategory]: prev[selectedCategory].filter(p => p.id !== id)
    }));
  };

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
        
        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sélectionner l'année</label>
            <input 
              type="number" 
              className="input-field" 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value) || 2026)}
              placeholder="Ex: 2026"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Montant annuel global calculé</label>
            <input 
              type="text" 
              className="input-field" 
              value={`${parseFloat(montantGlobalAnnuel || '0').toFixed(2)} €`}
              disabled
              style={{ fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'var(--input-bg)' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Saisie détaillée par catégorie</label>
          <select 
            className="input-field" 
            onChange={handleCategorySelect}
            defaultValue=""
          >
            <option value="" disabled>-- Choisir une catégorie --</option>
            <option value="gaz">🔥 Gaz</option>
            <option value="electricite">⚡ Électricité</option>
            <option value="autres">🌐 Autres Charges (Internet/Chaudiere)</option>
            <option value="communes">🏠 Charges communes</option>
          </select>
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

      {/* Modal de Saisie des Charges par Catégorie */}
      {showChargeModal && selectedCategory && (
        <div className="modal-overlay" onClick={() => { setShowChargeModal(false); setSelectedCategory(''); }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedCategory === 'gaz' && <Flame size={18} style={{ color: '#ef4444' }} />}
                {selectedCategory === 'electricite' && <Zap size={18} style={{ color: '#eab308' }} />}
                {selectedCategory === 'autres' && <Wifi size={18} style={{ color: '#06b6d4' }} />}
                {selectedCategory === 'communes' && <Home size={18} style={{ color: '#10b981' }} />}
                <span style={{ marginLeft: '4px' }}>
                  {selectedCategory === 'gaz' && 'Saisie du Gaz'}
                  {selectedCategory === 'electricite' && 'Saisie de l\'Électricité'}
                  {selectedCategory === 'autres' && 'Saisie des Autres Charges'}
                  {selectedCategory === 'communes' && 'Saisie des Charges communes'}
                </span>
              </div>
              <button className="icon-btn" onClick={() => { setShowChargeModal(false); setSelectedCategory(''); }} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              {/* Formulaire d'ajout de période */}
              <form onSubmit={handleAddPeriod} style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
                  Ajouter une période :
                </span>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date de début *</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={newPeriodStart}
                      onChange={(e) => setNewPeriodStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de fin *</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={newPeriodEnd}
                      onChange={(e) => setNewPeriodEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Montant (€) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={newPeriodAmount}
                    onChange={(e) => setNewPeriodAmount(e.target.value)}
                    placeholder="Ex: 150.00"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>

                {periodError && (
                  <div style={{ color: 'var(--danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
                    <AlertCircle size={14} />
                    <span>{periodError}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '14px', padding: '10px 16px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', fontWeight: 'bold' }}
                >
                  Ajouter cette période
                </button>
              </form>

              {/* Liste des périodes déjà saisies */}
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
                Périodes enregistrées :
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {chargesDetaillees[selectedCategory].length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                    Aucune période saisie pour le moment.
                  </p>
                ) : (
                  chargesDetaillees[selectedCategory].map((p) => (
                    <div 
                      key={p.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 12px', 
                        backgroundColor: 'var(--input-bg)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-md)' 
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Du {new Date(p.dateDebut).toLocaleDateString('fr-FR')} au {new Date(p.dateFin).toLocaleDateString('fr-FR')}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {p.montant.toFixed(2)} €
                        </span>
                      </div>
                      <button 
                        type="button" 
                        className="icon-btn icon-btn-danger" 
                        onClick={() => handleDeletePeriod(p.id)}
                        aria-label="Supprimer cette période"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>
                Total : {chargesDetaillees[selectedCategory].reduce((sum, p) => sum + p.montant, 0).toFixed(2)} €
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setShowChargeModal(false); setSelectedCategory(''); }} 
                style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
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

