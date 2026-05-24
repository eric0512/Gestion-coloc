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

  // --- État pour l'avance mensuelle par année ---
  const [avancesMensuelles, setAvancesMensuelles] = useState<{ [year: number]: number }>(() => {
    const saved = localStorage.getItem('coloc_avances_mensuelles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return { 2026: 150 }; // valeur par défaut initiale
  });

  // --- Effet pour initialiser/reconduire l'avance mensuelle sur les nouvelles années ---
  useEffect(() => {
    setAvancesMensuelles(prev => {
      if (prev[selectedYear] !== undefined) return prev;
      
      const yearsWithValues = Object.keys(prev)
        .map(Number)
        .filter(y => y < selectedYear)
        .sort((a, b) => b - a);

      let carryOverValue = 150;
      if (yearsWithValues.length > 0) {
        carryOverValue = prev[yearsWithValues[0]];
      } else {
        const allYears = Object.keys(prev).map(Number).sort((a, b) => a - b);
        if (allYears.length > 0) {
          carryOverValue = prev[allYears[0]];
        }
      }

      const updated = { ...prev, [selectedYear]: carryOverValue };
      localStorage.setItem('coloc_avances_mensuelles', JSON.stringify(updated));
      return updated;
    });
  }, [selectedYear]);

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
  };

  const handleAvanceChange = (value: number) => {
    setAvancesMensuelles(prev => {
      const updated = { ...prev, [selectedYear]: value };
      localStorage.setItem('coloc_avances_mensuelles', JSON.stringify(updated));
      return updated;
    });
  };

  const avanceMensuelle = avancesMensuelles[selectedYear] !== undefined ? avancesMensuelles[selectedYear] : 150;

  // --- États Modals ---
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'gaz' | 'electricite' | 'autres' | 'communes' | ''>('');

  // --- États Formulaire de Période ---
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [isManualDate, setIsManualDate] = useState(false);
  const [newPeriodAmount, setNewPeriodAmount] = useState('');
  const [periodError, setPeriodError] = useState('');

  // --- Fonctions d'aide pour saisie de date manuelle ---
  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 8);
    const parts = [];
    if (digits.length > 0) parts.push(digits.substring(0, 2));
    if (digits.length > 2) parts.push(digits.substring(2, 4));
    if (digits.length > 4) parts.push(digits.substring(4, 8));
    return parts.join('/');
  };

  const frenchToIsoDate = (frenchDate: string) => {
    const parts = frenchDate.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (day.length === 2 && month.length === 2 && year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    return '';
  };

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

    const startIso = isManualDate ? frenchToIsoDate(manualStart) : newPeriodStart;
    const endIso = isManualDate ? frenchToIsoDate(manualEnd) : newPeriodEnd;

    if (!startIso || !endIso) {
      setPeriodError('Veuillez saisir des dates valides (format JJ/MM/AAAA au clavier).');
      return;
    }

    if (endIso < startIso) {
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
      dateDebut: startIso,
      dateFin: endIso,
      montant: amt
    };

    setChargesDetaillees(prev => ({
      ...prev,
      [selectedCategory]: [...prev[selectedCategory], newPeriod]
    }));

    // Réinitialiser les champs
    setNewPeriodStart('');
    setNewPeriodEnd('');
    setManualStart('');
    setManualEnd('');
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
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Sélectionner l'année</label>
              <input 
                type="number" 
                className="input-field" 
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value) || 2026)}
                placeholder="Ex: 2026"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Montant de l'avance mensuelle (€)</label>
              <input 
                type="number" 
                className="input-field" 
                value={avanceMensuelle || ''}
                onChange={(e) => handleAvanceChange(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 150.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Charges annuelles</label>
              <input 
                type="text" 
                className="input-field" 
                value={`${parseFloat(montantGlobalAnnuel || '0').toFixed(2)} €`}
                disabled
                style={{ fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'var(--input-bg)' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Avances annuelles cumulées</label>
              <input 
                type="text" 
                className="input-field" 
                value={`${(avanceMensuelle * 12).toFixed(2)} €`}
                disabled
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--input-bg)' }}
              />
            </div>
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
                                      flexDirection: 'column',
                                      gap: '4px',
                                      padding: '10px 0',
                                      borderBottom: '1px dashed var(--border-color)',
                                      opacity: isPresent ? 1 : 0.4
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{part.nomComplet}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {part.joursPresence} jours / {rep.daysInMonth} présents
                                      </span>
                                    </div>
                                    
                                    {isPresent && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        <span>Charge : <strong style={{ color: 'var(--text-primary)' }}>{part.montantDu.toFixed(2)} €</strong></span>
                                        <span>Avance : <strong style={{ color: 'var(--text-primary)' }}>{(part.avanceDue || 0).toFixed(2)} €</strong></span>
                                        <span>
                                          Solde :{' '}
                                          <strong style={{ 
                                            color: (part.solde || 0) > 0 ? 'var(--danger)' : (part.solde || 0) < 0 ? 'var(--success)' : 'var(--text-primary)' 
                                          }}>
                                            {(part.solde || 0) > 0 ? '+' : ''}{(part.solde || 0).toFixed(2)} €
                                          </strong>
                                        </span>
                                      </div>
                                    )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Ajouter une période :
                  </span>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setIsManualDate(!isManualDate)}
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                  >
                    {isManualDate ? '📅 Mode calendrier' : '⌨️ Mode clavier (JJ/MM/AAAA)'}
                  </button>
                </div>
                
                {isManualDate ? (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date de début (JJ/MM/AAAA) *</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={manualStart}
                        onChange={(e) => setManualStart(formatDateInput(e.target.value))}
                        placeholder="Ex: 01/01/2026"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date de fin (JJ/MM/AAAA) *</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={manualEnd}
                        onChange={(e) => setManualEnd(formatDateInput(e.target.value))}
                        placeholder="Ex: 31/12/2026"
                        required
                      />
                    </div>
                  </div>
                ) : (
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
                )}

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

