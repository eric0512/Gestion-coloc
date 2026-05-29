import { useState, useEffect } from 'react';
import { Calculator, DollarSign, AlertCircle, Flame, Zap, Wifi, Trash2, X, Home, Wrench } from 'lucide-react';

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export interface PeriodeCharge {
  id: string;
  dateDebut: string;
  dateFin: string;
  montant: number;
}

export interface ChargesDetaillees {
  gaz: PeriodeCharge[];
  electricite: PeriodeCharge[];
  internet: PeriodeCharge[];
  chaudiere: PeriodeCharge[];
  communes: PeriodeCharge[];
}

interface CalculateurProps {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  montantGlobalAnnuel: string;
  setMontantGlobalAnnuel: (amount: string) => void;
  onNavigate: (tab: 'home' | 'colocs' | 'calculator' | 'history') => void;
  onTriggerSync?: () => void;
}

export default function Calculateur({
  selectedYear,
  setSelectedYear,
  montantGlobalAnnuel,
  setMontantGlobalAnnuel,
  onNavigate,
  onTriggerSync
}: CalculateurProps) {
  
  console.log("CALCULATEUR RENDER", { selectedYear, montantGlobalAnnuel });

  // --- État des charges détaillées ---
  const [chargesDetaillees, setChargesDetaillees] = useState<ChargesDetaillees>(() => {
    const saved = localStorage.getItem('coloc_charges_detaillees');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration : si les anciennes données "autres" existent, les migrer vers "internet"
        if (parsed.autres && !parsed.internet) {
          parsed.internet = parsed.autres;
          delete parsed.autres;
        }
        if (!parsed.chaudiere) parsed.chaudiere = [];
        return parsed;
      } catch (e) {
        // fallback
      }
    }
    return {
      gaz: [],
      electricite: [],
      internet: [],
      chaudiere: [],
      communes: []
    };
  });

  // --- État et logique des factures mensuelles ---
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState<number | null>(null);

  const getInvoicesForMonth = (m: number, year: number) => {
    const results: { category: string; dateDebut: string; dateFin: string; montant: number; id: string }[] = [];
    
    const categories: ('gaz' | 'electricite' | 'internet' | 'chaudiere' | 'communes')[] = ['gaz', 'electricite', 'internet', 'chaudiere', 'communes'];
    const labels = {
      gaz: '🔥 Gaz',
      electricite: '⚡ Électricité',
      internet: '🌐 Internet',
      chaudiere: '🔧 Révision Chaudière',
      communes: '🏠 Charges communes'
    };
    
    categories.forEach(cat => {
      const periods = chargesDetaillees[cat] || [];
      periods.forEach(p => {
        let invoiceMonth = -1;
        let invoiceYear = -1;
        
        // Extrait le timestamp de l'id (ex: 'period-1779669600000') pour savoir quand la saisie a été faite
        if (p.id && p.id.startsWith('period-')) {
          const tsStr = p.id.split('-')[1];
          const ts = parseInt(tsStr);
          if (!isNaN(ts)) {
            const entryDate = new Date(ts);
            invoiceMonth = entryDate.getMonth(); // 0-11
            invoiceYear = entryDate.getFullYear();
          }
        }
        
        // Fallback sur dateDebut si l'id n'a pas de timestamp ou est invalide
        if ((invoiceMonth === -1 || invoiceYear === -1) && p.dateDebut) {
          const invoiceStart = new Date(p.dateDebut);
          invoiceMonth = invoiceStart.getMonth();
          invoiceYear = invoiceStart.getFullYear();
        }
        
        if (invoiceYear === year && invoiceMonth === m) {
          results.push({
            category: labels[cat],
            dateDebut: p.dateDebut,
            dateFin: p.dateFin,
            montant: p.montant,
            id: p.id
          });
        }
      });
    });
    
    return results;
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
  };

  // --- États Modals ---
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'gaz' | 'electricite' | 'internet' | 'chaudiere' | 'communes' | ''>('');

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

  const getProratedPeriodsForYear = (periods: PeriodeCharge[], year: number, _category: string) => {
    const yearStartStr = `${year}-06-01`;
    const yearEndStr = `${year + 1}-05-31`;

    return periods
      .filter(p => p.dateDebut <= yearEndStr && p.dateFin >= yearStartStr)
      .map(p => {
        // Somme des poids sur toute la période
        let totalWeight = 0;
        const current = new Date(p.dateDebut);
        const end = new Date(p.dateFin);
        while (current <= end) {
          let weight = 1.0;
          totalWeight += weight;
          current.setDate(current.getDate() + 1);
        }

        const baseDailyCost = totalWeight > 0 ? p.montant / totalWeight : 0;

        const overlapStart = p.dateDebut > yearStartStr ? p.dateDebut : yearStartStr;
        const overlapEnd = p.dateFin < yearEndStr ? p.dateFin : yearEndStr;

        let proratedAmount = 0;
        let overlapDays = 0;

        if (overlapStart <= overlapEnd) {
          const currentInt = new Date(overlapStart);
          const limitInt = new Date(overlapEnd);
          while (currentInt <= limitInt) {
            let weight = 1.0;
            proratedAmount += baseDailyCost * weight;
            overlapDays++;
            currentInt.setDate(currentInt.getDate() + 1);
          }
        }

        const startD = new Date(p.dateDebut);
        const endD = new Date(p.dateFin);
        const totalDays = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return {
          ...p,
          montantAffiche: proratedAmount,
          isProrated: totalDays !== overlapDays,
          totalDays,
          overlapDays
        };
      });
  };

  // --- Calculer et synchroniser le montant global ---
  useEffect(() => {
    localStorage.setItem('coloc_charges_detaillees', JSON.stringify(chargesDetaillees));
    
    const gpGaz = getProratedPeriodsForYear(chargesDetaillees.gaz || [], selectedYear, 'gaz');
    const gpElec = getProratedPeriodsForYear(chargesDetaillees.electricite || [], selectedYear, 'electricite');
    const gpInternet = getProratedPeriodsForYear(chargesDetaillees.internet || [], selectedYear, 'internet');
    const gpChaudiere = getProratedPeriodsForYear(chargesDetaillees.chaudiere || [], selectedYear, 'chaudiere');
    const gpCommunes = getProratedPeriodsForYear(chargesDetaillees.communes || [], selectedYear, 'communes');

    const total = [
      ...gpGaz,
      ...gpElec,
      ...gpInternet,
      ...gpChaudiere,
      ...gpCommunes
    ].reduce((sum, p) => sum + p.montantAffiche, 0);

    setMontantGlobalAnnuel(total.toFixed(2));
    
    if (onTriggerSync) {
      onTriggerSync();
    }
  }, [chargesDetaillees, selectedYear, setMontantGlobalAnnuel, onTriggerSync]);

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value as 'gaz' | 'electricite' | 'internet' | 'chaudiere' | 'communes' | '';
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

  const gazPeriods = getProratedPeriodsForYear(chargesDetaillees.gaz || [], selectedYear, 'gaz');
  const elecPeriods = getProratedPeriodsForYear(chargesDetaillees.electricite || [], selectedYear, 'electricite');
  const internetPeriods = getProratedPeriodsForYear(chargesDetaillees.internet || [], selectedYear, 'internet');
  const chaudierePeriods = getProratedPeriodsForYear(chargesDetaillees.chaudiere || [], selectedYear, 'chaudiere');
  const communesPeriods = getProratedPeriodsForYear(chargesDetaillees.communes || [], selectedYear, 'communes');

  const totalGaz = gazPeriods.reduce((sum, p) => sum + p.montantAffiche, 0);
  const totalElec = elecPeriods.reduce((sum, p) => sum + p.montantAffiche, 0);
  const totalInternet = internetPeriods.reduce((sum, p) => sum + p.montantAffiche, 0);
  const totalChaudiere = chaudierePeriods.reduce((sum, p) => sum + p.montantAffiche, 0);
  const totalCommunes = communesPeriods.reduce((sum, p) => sum + p.montantAffiche, 0);

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
        <p className="card-subtitle" style={{ marginTop: '-8px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Les charges annuelles sont calculées de juin à mai (du 1er juin au 31 mai).
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Sélectionner l'année */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ minHeight: '38px', display: 'flex', alignItems: 'flex-end' }}>Sélectionner l'année</label>
            <select 
              className="input-field" 
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value) || 2026)}
            >
              <option value={2024}>2024-2025</option>
              <option value={2025}>2025-2026</option>
              <option value={2026}>2026-2027</option>
              <option value={2027}>2027-2028</option>
              <option value={2028}>2028-2029</option>
              <option value={2029}>2029-2030</option>
              <option value={2030}>2030-2031</option>
            </select>
          </div>

          {/* Charges annuelles */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ minHeight: '38px', display: 'flex', alignItems: 'flex-end' }}>Charges annuelles</label>
            <input 
              type="text" 
              className="input-field" 
              value={`${(totalGaz + totalElec + totalInternet + totalChaudiere + totalCommunes).toFixed(2)} €`}
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
            <option value="internet">🌐 Internet</option>
            <option value="chaudiere">🔧 Révision Chaudière</option>
            <option value="communes">🏠 Charges communes</option>
          </select>
        </div>

      </div>

      {/* Récapitulatif des charges par catégorie pour l'année sélectionnée */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--secondary)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Calculator size={16} style={{ color: 'var(--secondary)' }} />
          <span>Récapitulatif des Charges ({selectedYear}-{selectedYear + 1})</span>
        </div>
        <p className="card-subtitle" style={{ marginBottom: '16px' }}>
          Total des dépenses réelles réparties par catégorie de charges pour l'exercice {selectedYear}-{selectedYear + 1}.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Gaz */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span>🔥 Gaz</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                {totalGaz.toFixed(2)} €
              </span>
            </div>
            {gazPeriods.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                {gazPeriods.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Du {new Date(p.dateDebut).toLocaleDateString('fr-FR')} au {new Date(p.dateFin).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontWeight: 600 }}>
                      {p.isProrated ? `${p.montantAffiche.toFixed(2)} € (sur ${p.montant.toFixed(2)} €)` : `${p.montant.toFixed(2)} €`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                Aucune charge de gaz saisie pour {selectedYear}-{selectedYear + 1}
              </span>
            )}
          </div>

          {/* Electricité */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span>⚡ Électricité</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                {totalElec.toFixed(2)} €
              </span>
            </div>
            {elecPeriods.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                {elecPeriods.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Du {new Date(p.dateDebut).toLocaleDateString('fr-FR')} au {new Date(p.dateFin).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontWeight: 600 }}>
                      {p.isProrated ? `${p.montantAffiche.toFixed(2)} € (sur ${p.montant.toFixed(2)} €)` : `${p.montant.toFixed(2)} €`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                Aucune charge d'électricité saisie pour {selectedYear}-{selectedYear + 1}
              </span>
            )}
          </div>

          {/* Internet */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span>🌐 Internet</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                {totalInternet.toFixed(2)} €
              </span>
            </div>
            {internetPeriods.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                {internetPeriods.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Du {new Date(p.dateDebut).toLocaleDateString('fr-FR')} au {new Date(p.dateFin).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontWeight: 600 }}>
                      {p.isProrated ? `${p.montantAffiche.toFixed(2)} € (sur ${p.montant.toFixed(2)} €)` : `${p.montant.toFixed(2)} €`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                Aucune charge internet saisie pour {selectedYear}-{selectedYear + 1}
              </span>
            )}
          </div>

          {/* Révision Chaudière */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <Wrench size={16} style={{ color: '#f97316' }} />
                <span>🔧 Révision Chaudière</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                {totalChaudiere.toFixed(2)} €
              </span>
            </div>
            {chaudierePeriods.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                {chaudierePeriods.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Du {new Date(p.dateDebut).toLocaleDateString('fr-FR')} au {new Date(p.dateFin).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontWeight: 600 }}>
                      {p.isProrated ? `${p.montantAffiche.toFixed(2)} € (sur ${p.montant.toFixed(2)} €)` : `${p.montant.toFixed(2)} €`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                Aucune charge de révision chaudière saisie pour {selectedYear}-{selectedYear + 1}
              </span>
            )}
          </div>

          {/* Communes */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span>🏠 Charges communes</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                {totalCommunes.toFixed(2)} €
              </span>
            </div>
            {communesPeriods.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                {communesPeriods.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Du {new Date(p.dateDebut).toLocaleDateString('fr-FR')} au {new Date(p.dateFin).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontWeight: 600 }}>
                      {p.isProrated ? `${p.montantAffiche.toFixed(2)} € (sur ${p.montant.toFixed(2)} €)` : `${p.montant.toFixed(2)} €`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                Aucune charge commune saisie pour {selectedYear}-{selectedYear + 1}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Saisie des Charges par Catégorie */}
      {showChargeModal && selectedCategory && (
        <div className="modal-overlay" onClick={() => { setShowChargeModal(false); setSelectedCategory(''); }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedCategory === 'gaz' && <Flame size={18} style={{ color: '#ef4444' }} />}
                {selectedCategory === 'electricite' && <Zap size={18} style={{ color: '#eab308' }} />}
                {selectedCategory === 'internet' && <Wifi size={18} style={{ color: '#06b6d4' }} />}
                {selectedCategory === 'chaudiere' && <Wrench size={18} style={{ color: '#f97316' }} />}
                {selectedCategory === 'communes' && <Home size={18} style={{ color: '#10b981' }} />}
                <span style={{ marginLeft: '4px' }}>
                  {selectedCategory === 'gaz' && 'Saisie du Gaz'}
                  {selectedCategory === 'electricite' && 'Saisie de l\'Électricité'}
                  {selectedCategory === 'internet' && 'Saisie d\'Internet'}
                  {selectedCategory === 'chaudiere' && 'Saisie de la Révision Chaudière'}
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

      {/* Modal d'affichage des factures du mois */}
      {selectedInvoiceMonth !== null && (
        <div className="modal-overlay" onClick={() => setSelectedInvoiceMonth(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--danger)' }}>
                <Calculator size={18} />
                <span style={{ marginLeft: '6px' }}>
                  Factures - {NOMS_MOIS[selectedInvoiceMonth]} {selectedYear}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setSelectedInvoiceMonth(null)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {getInvoicesForMonth(selectedInvoiceMonth, selectedYear).map(inv => {
                  const dateStr = inv.dateDebut === inv.dateFin 
                    ? `le ${new Date(inv.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`
                    : `du ${new Date(inv.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} au ${new Date(inv.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
                  
                  return (
                    <div 
                      key={inv.id}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--input-bg)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {inv.category}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {dateStr}
                        </span>
                      </div>
                      <span style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '14px' }}>
                        {inv.montant.toFixed(2)} €
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelectedInvoiceMonth(null)} 
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

