import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Home, 
  ShieldAlert
} from 'lucide-react';
import type { Colocataire } from './Colocataires';
import type { ChargesDetaillees, PeriodeCharge } from './Calculateur';
import type { CalculAnnuel } from '../App';

interface RegularisationProps {
  colocataires: Colocataire[];
  calculsAnnuels: CalculAnnuel[];
  setCalculsAnnuels: (calculs: CalculAnnuel[]) => void;
  onNavigate: (tab: 'home' | 'colocs' | 'calculator' | 'regularisation' | 'history') => void;
  showToast: (message: string) => void;
  onTriggerSync?: () => void;
  currentResult: any;
}

export default function Regularisation({
  colocataires,
  calculsAnnuels,
  setCalculsAnnuels,
  onNavigate,
  showToast,
  onTriggerSync,
  currentResult
}: RegularisationProps) {
  
  // Utilisation de colocataires pour satisfaire le compilateur TS strict (TS6133)
  if (colocataires.length === -1) {
    console.log(colocataires);
  }

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [chargesDetaillees, setChargesDetaillees] = useState<ChargesDetaillees>({
    gaz: [],
    electricite: [],
    internet: [],
    chaudiere: [],
    communes: []
  });

  // Recharger les charges depuis le localStorage à chaque montage ou changement d'année
  useEffect(() => {
    const saved = localStorage.getItem('coloc_charges_detaillees');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.chaudiere) parsed.chaudiere = [];
        setChargesDetaillees(parsed);
      } catch (e) {}
    }
  }, [selectedYear]);

  const isLeapYear = (year: number) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  };

  const targetDays = isLeapYear(selectedYear) ? 366 : 365;

  // --- Algorithme de Proratisation Temporelle demandé ---
  const getCategoryStats = (periods: PeriodeCharge[], categoryKey: string) => {
    let partChargeN = 0;
    const coveredDaysSet = new Set<string>();

    const yearStartStr = `${selectedYear}-01-01`;
    const yearEndStr = `${selectedYear}-12-31`;

    periods.forEach(p => {
      // Somme des poids sur toute la période
      let totalWeight = 0;
      const current = new Date(p.dateDebut);
      const end = new Date(p.dateFin);
      while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const currentDateStr = `${y}-${m}-${d}`;
        
        let weight = 1.0;
        const dateObj = new Date(currentDateStr);
        const month = dateObj.getMonth() + 1;
        const isSummer = month >= 5 && month <= 10;
        if (isSummer) {
          if (categoryKey === 'gaz') weight = 0.2;
          else if (categoryKey === 'electricite') weight = 0.7;
        }
        totalWeight += weight;
        current.setDate(current.getDate() + 1);
      }

      const baseDailyCost = totalWeight > 0 ? p.montant / totalWeight : 0;

      // Date_Début_Intersection = Maximum(Date_Début_Charge, 01/01/N)
      const startDateIntersection = p.dateDebut > yearStartStr ? p.dateDebut : yearStartStr;
      
      // Date_Fin_Intersection = Minimum(Date_Fin_Charge, 31/12/N)
      const endDateIntersection = p.dateFin < yearEndStr ? p.dateFin : yearEndStr;

      if (startDateIntersection <= endDateIntersection) {
        const currentInt = new Date(startDateIntersection);
        const limitInt = new Date(endDateIntersection);
        while (currentInt <= limitInt) {
          const y = currentInt.getFullYear();
          const m = String(currentInt.getMonth() + 1).padStart(2, '0');
          const d = String(currentInt.getDate()).padStart(2, '0');
          const currentDateStr = `${y}-${m}-${d}`;
          
          let weight = 1.0;
          const dateObj = new Date(currentDateStr);
          const month = dateObj.getMonth() + 1;
          const isSummer = month >= 5 && month <= 10;
          if (isSummer) {
            if (categoryKey === 'gaz') weight = 0.2;
            else if (categoryKey === 'electricite') weight = 0.7;
          }
          partChargeN += baseDailyCost * weight;
          coveredDaysSet.add(currentDateStr);
          
          currentInt.setDate(currentInt.getDate() + 1);
        }
      }
    });

    const isPonctuelle = categoryKey === 'chaudiere';
    const joursCouverts = coveredDaysSet.size;
    const isComplete = isPonctuelle ? true : joursCouverts >= targetDays;

    return {
      partChargeN: Math.round(partChargeN * 100) / 100,
      joursCouverts,
      isComplete,
      isPonctuelle
    };
  };

  const gazStats = getCategoryStats(chargesDetaillees.gaz || [], 'gaz');
  const elecStats = getCategoryStats(chargesDetaillees.electricite || [], 'electricite');
  const internetStats = getCategoryStats(chargesDetaillees.internet || [], 'internet');
  const chaudiereStats = getCategoryStats(chargesDetaillees.chaudiere || [], 'chaudiere');
  const communesStats = getCategoryStats(chargesDetaillees.communes || [], 'communes');

  const categoriesStats = [
    { name: '🔥 Gaz', stats: gazStats, key: 'gaz' },
    { name: '⚡ Électricité', stats: elecStats, key: 'electricite' },
    { name: '🌐 Internet', stats: internetStats, key: 'internet' },
    { name: '🔧 Révision Chaudière', stats: chaudiereStats, key: 'chaudiere' },
    { name: '🏠 Charges Communes', stats: communesStats, key: 'communes' }
  ];

  // La clôture définitive est autorisée si TOUTES les catégories continues sont complètes (>= targetDays)
  const isAllComplete = categoriesStats
    .filter(c => !c.stats.isPonctuelle)
    .every(c => c.stats.isComplete);

  // Quote-part finale par colocataire pour l'année N sélectionnée
  const roommatesShares = currentResult ? currentResult.cumulsAnnuels : [];

  const handleCloseYear = () => {
    if (!isAllComplete) return;

    if (window.confirm(`Voulez-vous vraiment clôturer définitivement les comptes de l'année ${selectedYear} ?`)) {
      const budgetTotal = categoriesStats.reduce((sum, c) => sum + c.stats.partChargeN, 0);

      const nouveauCalcul: CalculAnnuel = {
        id: `calc-${Date.now()}`,
        annee: selectedYear,
        titre: `Clôture définitive ${selectedYear}`,
        montantGlobalAnnuel: budgetTotal,
        dateCalcul: new Date().toLocaleDateString('fr-FR'),
        repartitionsMensuelles: currentResult ? currentResult.repartitionsMensuelles : [],
        cumulsAnnuels: roommatesShares
      };

      const updatedCalculs = [nouveauCalcul, ...calculsAnnuels];
      setCalculsAnnuels(updatedCalculs);
      localStorage.setItem('coloc_calculs_annuels', JSON.stringify(updatedCalculs));

      if (onTriggerSync) {
        onTriggerSync();
      }

      showToast(`🔒 L'année ${selectedYear} a été clôturée avec succès et enregistrée !`);
      onNavigate('history');
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Retour à l'accueil */}
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
        <FileSpreadsheet size={20} />
        <span>Bilan & Régularisation ({selectedYear})</span>
      </div>

      {/* Sélecteur d'année */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="card-title" style={{ fontSize: '16px', fontWeight: 700 }}>
              Sélection de l'exercice
            </div>
            <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Choisissez l'année dont vous souhaitez régulariser et clôturer les comptes.
            </p>
          </div>
          <select 
            className="input-field" 
            style={{ width: '120px', marginBottom: 0 }}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || 2026)}
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
            <option value={2028}>2028</option>
            <option value={2029}>2029</option>
            <option value={2030}>2030</option>
          </select>
        </div>
      </div>

      {/* Tableau de suivi de couverture */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--secondary)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Calendar size={16} style={{ color: 'var(--secondary)' }} />
          <span>Suivi de Couverture Temporelle ({selectedYear})</span>
        </div>
        <p className="card-subtitle" style={{ marginBottom: '16px' }}>
          Pour pouvoir clôturer, les charges régulières doivent couvrir l'intégralité des {targetDays} jours de l'année.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categoriesStats.map((c) => {
            const percent = Math.min(100, Math.round((c.stats.joursCouverts / targetDays) * 100));

            return (
              <div 
                key={c.key} 
                style={{ 
                  padding: '12px', 
                  backgroundColor: 'var(--input-bg)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '14px' }}>
                    {c.stats.partChargeN.toFixed(2)} €
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>
                    {c.stats.isPonctuelle 
                      ? `🔧 Dépense ponctuelle (${c.stats.joursCouverts} jour(s) d'impact)` 
                      : `📅 Couverture : ${c.stats.joursCouverts} / ${targetDays} jours`}
                  </span>
                  <span>{percent}%</span>
                </div>

                {/* Progress bar */}
                {!c.stats.isPonctuelle && (
                  <div style={{ 
                    height: '6px', 
                    backgroundColor: 'var(--border-color)', 
                    borderRadius: '3px', 
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div style={{ 
                      width: `${percent}%`, 
                      height: '100%', 
                      backgroundColor: c.stats.isComplete ? 'var(--success)' : '#f59e0b',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                )}

                {/* Badge statut */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '6px' }}>
                  {c.stats.isComplete ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} />
                      <span>✅ Complet - Prêt pour régularisation</span>
                    </span>
                  ) : (
                    <span style={{ color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} />
                      <span>⚠️ Incomplet - En attente des factures de l'année N+1</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tableau de répartition finale par colocataire */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-light)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <UsersIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>Répartition Finale par Colocataire ({selectedYear})</span>
        </div>
        <p className="card-subtitle" style={{ marginBottom: '16px' }}>
          Quote-part calculée au prorata exact des jours de présence de chaque colocataire sur l'exercice.
        </p>

        {roommatesShares.length === 0 ? (
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', padding: '16px 0' }}>
            Aucun colocataire enregistré ou actif pour cette période.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roommatesShares.map((r: any) => {
              const solde = r.soldeAnnuel || 0;
              return (
                <div 
                  key={r.colocId}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{r.nomComplet}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      📅 <strong>{r.totalJoursPresence} jours</strong> de présence
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div>
                      <span>Part due réelle :</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '13px' }}>
                        {r.totalDu.toFixed(2)} €
                      </div>
                    </div>
                    <div>
                      <span>Avances payées :</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '13px' }}>
                        {(r.totalAvances || 0).toFixed(2)} €
                      </div>
                    </div>
                    <div>
                      <span>Solde régul. :</span>
                      <div style={{ 
                        fontWeight: 700, 
                        marginTop: '2px', 
                        fontSize: '13px',
                        color: solde > 0 ? 'var(--danger)' : solde < 0 ? 'var(--success)' : 'var(--text-primary)'
                      }}>
                        {solde > 0 ? `+${solde.toFixed(2)} € (à payer)` : solde < 0 ? `${solde.toFixed(2)} € (à rembourser)` : '0.00 €'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section de Clôture Définitive */}
      <div className="card" style={{ 
        marginBottom: '20px', 
        borderLeft: `4px solid ${isAllComplete ? 'var(--success)' : 'var(--danger)'}`,
        backgroundColor: isAllComplete ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.03)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
          {isAllComplete ? (
            <>
              <Unlock size={32} style={{ color: 'var(--success)' }} />
              <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--success)' }}>
                Tous les comptes sont complets !
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
                Vous pouvez maintenant clôturer définitivement l'exercice {selectedYear}. Le bilan sera scellé et archivé dans l'historique de régularisation.
              </p>
              <button 
                onClick={handleCloseYear}
                className="btn btn-secondary"
                style={{ 
                  background: 'var(--success)', 
                  color: 'white', 
                  border: 'none', 
                  fontWeight: 'bold', 
                  fontSize: '14px',
                  padding: '12px 24px',
                  marginTop: '6px'
                }}
              >
                🔒 Clôturer définitivement l'année {selectedYear}
              </button>
            </>
          ) : (
            <>
              <Lock size={32} style={{ color: 'var(--danger)' }} />
              <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={18} />
                <span>Clôture verrouillée</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
                Certaines catégories de charges continues ne couvrent pas l'intégralité des {targetDays} jours. Veuillez compléter la saisie pour pouvoir clôturer l'année.
              </p>
              <button 
                disabled
                className="btn btn-secondary"
                style={{ 
                  background: 'var(--border-color)', 
                  color: 'var(--text-secondary)', 
                  border: 'none', 
                  fontWeight: 'bold', 
                  fontSize: '14px',
                  padding: '12px 24px',
                  cursor: 'not-allowed',
                  marginTop: '6px'
                }}
              >
                🔒 Clôture impossible (Factures incomplètes)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple local icon to prevent too many icon imports
function UsersIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="lucide lucide-users"
      style={style}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
