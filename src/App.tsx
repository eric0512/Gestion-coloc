import { useState, useEffect } from 'react';
import { 
  Users, 
  Calculator, 
  History, 
  Moon, 
  Sun, 
  SunMoon,
  Check, 
  Home,
  Monitor,
  Smartphone,
  RefreshCw
} from 'lucide-react';

import Accueil from './pages/Accueil';
import Colocataires from './pages/Colocataires';
import type { Colocataire } from './pages/Colocataires';
import Calculateur from './pages/Calculateur';
import Historique from './pages/Historique';
import { supabase } from './supabaseClient';

// --- Interfaces & Types partagés ---
export interface PartCalcul {
  colocId: string;
  nomComplet: string;
  joursPresence: number;
  montantDu: number;
  avanceDue?: number;
  solde?: number;
}

export interface RepartitionMensuelle {
  numeroMois: number; // 0 à 11
  nomMois: string; // "Janvier", "Février", etc.
  montantGlobalMois: number;
  totalJoursColocs: number;
  tauxJournalier: number;
  daysInMonth: number;
  parts: PartCalcul[];
}

export interface CumulAnnuelColoc {
  colocId: string;
  nomComplet: string;
  totalDu: number;
  totalJoursPresence: number;
  totalAvances?: number;
  soldeAnnuel?: number;
}

export interface CalculAnnuel {
  id: string;
  annee: number; // YYYY
  titre: string;
  montantGlobalAnnuel: number;
  dateCalcul: string;
  repartitionsMensuelles: RepartitionMensuelle[];
  cumulsAnnuels: CumulAnnuelColoc[];
}

// --- Données initiales de démonstration (Seed) ---
const SEED_COLOCATAIRES: Colocataire[] = [
  {
    id: 'coloc-1',
    nom: 'Dupont',
    prenom: 'Jean',
    dateEntree: '2026-01-01',
    dateSortie: null
  },
  {
    id: 'coloc-2',
    nom: 'Martin',
    prenom: 'Marie',
    dateEntree: '2026-02-15',
    dateSortie: null
  },
  {
    id: 'coloc-3',
    nom: 'Bernard',
    prenom: 'Paul',
    dateEntree: '2026-03-01',
    dateSortie: '2026-05-15' // Parti le 15 mai 2026
  }
];

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function App() {
  // --- États principaux ---
  const [colocataires, setColocataires] = useState<Colocataire[]>([]);
  const [calculsAnnuels, setCalculsAnnuels] = useState<CalculAnnuel[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'colocs' | 'calculator' | 'history'>('home');
  const [theme, setTheme] = useState<'light' | 'dim' | 'dark'>('dark');
  const [layoutMode, setLayoutMode] = useState<'phone' | 'fullscreen'>('phone');
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  // --- États de Synchronisation Supabase ---
  const [hasLoadedFromSupabase, setHasLoadedFromSupabase] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // --- Accordéon de détails mensuels ---
  const [expandedMonth, setExpandedMonth] = useState<number | null>(4); // Mai ouvert par défaut

  // --- États Saisie des Charges Annuelles ---
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [montantGlobalAnnuel, setMontantGlobalAnnuel] = useState<string>('7200'); // 7200 € / an par défaut
  const [calculDescription, setCalculDescription] = useState('Charges Annuelles Générales');

  // --- Initialisation & LocalStorage & Chargement Supabase ---
  useEffect(() => {
    // Thème par défaut
    const savedTheme = localStorage.getItem('coloc_theme') as 'light' | 'dim' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Chargement du mode de mise en page (Plein Écran / Téléphone)
    const savedLayout = localStorage.getItem('coloc_layout_mode') as 'phone' | 'fullscreen' | null;
    if (savedLayout) {
      setLayoutMode(savedLayout);
    }

    // Chargement local initial (fallback rapide)
    const savedColocs = localStorage.getItem('coloc_colocataires');
    if (savedColocs) {
      setColocataires(JSON.parse(savedColocs));
    } else {
      setColocataires(SEED_COLOCATAIRES);
      localStorage.setItem('coloc_colocataires', JSON.stringify(SEED_COLOCATAIRES));
    }
    const savedCalculs = localStorage.getItem('coloc_calculs_annuels');
    if (savedCalculs) {
      setCalculsAnnuels(JSON.parse(savedCalculs));
    }

    // Chargement en ligne depuis Supabase
    async function loadFromSupabase() {
      try {
        const { data, error } = await supabase
          .from('code_utilisateurs')
          .select('Data')
          .eq('id', 1)
          .single();

        if (!error && data && data.Data) {
          const parsed = data.Data;
          if (parsed.colocataires) {
            setColocataires(parsed.colocataires);
            localStorage.setItem('coloc_colocataires', JSON.stringify(parsed.colocataires));
          }
          if (parsed.calculsAnnuels) {
            setCalculsAnnuels(parsed.calculsAnnuels);
            localStorage.setItem('coloc_calculs_annuels', JSON.stringify(parsed.calculsAnnuels));
          }
          if (parsed.avancesMensuelles) {
            localStorage.setItem('coloc_avances_mensuelles', JSON.stringify(parsed.avancesMensuelles));
          }
          if (parsed.chargesDetaillees) {
            localStorage.setItem('coloc_charges_detaillees', JSON.stringify(parsed.chargesDetaillees));
          }
          showToast('🔄 Synchronisé avec Supabase en ligne !');
        }
      } catch (e) {
        console.error('Erreur chargement Supabase', e);
      } finally {
        setHasLoadedFromSupabase(true);
      }
    }

    // Attendre un court instant après le premier rendu pour charger depuis Supabase
    setTimeout(() => loadFromSupabase(), 600);
  }, []);

  // --- Fonction de sauvegarde automatique vers Supabase ---
  const syncToSupabase = async (
    currentColocs: Colocataire[],
    currentCalculs: CalculAnnuel[]
  ) => {
    // Ne pas écraser la base si nous n'avons pas encore récupéré les données au démarrage
    if (!hasLoadedFromSupabase) return;

    try {
      setIsSyncing(true);
      const backupData = {
        colocataires: currentColocs,
        calculsAnnuels: currentCalculs,
        avancesMensuelles: JSON.parse(localStorage.getItem('coloc_avances_mensuelles') || '{}'),
        chargesDetaillees: JSON.parse(localStorage.getItem('coloc_charges_detaillees') || '{}')
      };

      const { error } = await supabase
        .from('code_utilisateurs')
        .upsert({ id: 1, Data: backupData });

      if (error) {
        console.error('Erreur upsert Supabase', error);
        showToast('⚠️ Erreur de synchronisation (Vérifiez RLS dans Supabase)');
      }
    } catch (e) {
      console.error('Erreur synchronisation Supabase', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerSync = () => {
    // Utilise les états actuels
    syncToSupabase(colocataires, calculsAnnuels);
  };

  // --- Thème ---
  const toggleTheme = () => {
    let nextTheme: 'light' | 'dim' | 'dark' = 'dark';
    if (theme === 'light') {
      nextTheme = 'dim';
    } else if (theme === 'dim') {
      nextTheme = 'dark';
    } else {
      nextTheme = 'light';
    }
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('coloc_theme', nextTheme);
    
    let modeLabel = 'sombre';
    if (nextTheme === 'light') modeLabel = 'clair';
    if (nextTheme === 'dim') modeLabel = 'intermédiaire (ardoise)';
    showToast(`Mode ${modeLabel} activé`);
  };

  // --- Mode de mise en page (Plein Écran / Téléphone) ---
  const toggleLayoutMode = () => {
    const nextLayout = layoutMode === 'phone' ? 'fullscreen' : 'phone';
    setLayoutMode(nextLayout);
    localStorage.setItem('coloc_layout_mode', nextLayout);
    showToast(nextLayout === 'fullscreen' ? 'Mode Plein Écran PC activé' : 'Mode Téléphone activé');
  };

  // --- Notifications ---
  const showToast = (message: string) => {
    setToast({ message, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // --- Algorithme de Répartition Annuelle au Prorata ---
  const performAnnualCalculation = () => {
    if (!selectedYear) return null;
    const annualAmount = parseFloat(montantGlobalAnnuel) || 0;
    const monthlyAmount = annualAmount / 12;

    // Charger l'avance mensuelle paramétrée pour l'année
    const savedAvances = localStorage.getItem('coloc_avances_mensuelles');
    let avancesMap: { [year: number]: number } = { 2026: 150 };
    if (savedAvances) {
      try {
        avancesMap = JSON.parse(savedAvances);
      } catch (e) {
        // fallback
      }
    }
    const currentAvanceMensuelle = avancesMap[selectedYear] !== undefined ? avancesMap[selectedYear] : 150;

    const formatDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const repartitionsMensuelles: RepartitionMensuelle[] = [];
    const cumulsColocsMap: { [colocId: string]: { totalDu: number; totalJours: number; totalAvances: number; nomComplet: string } } = {};

    colocataires.forEach(c => {
      cumulsColocsMap[c.id] = { totalDu: 0, totalJours: 0, totalAvances: 0, nomComplet: `${c.prenom} ${c.nom}` };
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentDay = now.getDate();

    for (let m = 0; m < 12; m++) {
      const startDate = new Date(selectedYear, m, 1);
      const endDate = new Date(selectedYear, m + 1, 0);
      const daysInMonth = endDate.getDate();

      // Ajuster la date limite de calcul pour le mois en cours ou les mois futurs
      let limitEndDate = new Date(endDate.getTime());
      
      if (selectedYear === currentYear) {
        if (m > currentMonth) {
          // Mois futur : aucune présence
          limitEndDate = new Date(selectedYear, m, 0);
        } else if (m === currentMonth) {
          // Mois en cours : limité à aujourd'hui (date de consultation)
          limitEndDate = new Date(selectedYear, m, currentDay);
        }
      } else if (selectedYear > currentYear) {
        // Année future : aucune présence
        limitEndDate = new Date(selectedYear, m, 0);
      }

      const parts: PartCalcul[] = [];
      let totalJoursColocs = 0;

      colocataires.forEach(coloc => {
        let activeDaysInMonth = 0;

        const current = new Date(startDate.getTime());
        while (current <= limitEndDate) {
          const currentStr = formatDateString(current);
          const hasEntered = currentStr >= coloc.dateEntree;
          const hasNotLeft = !coloc.dateSortie || currentStr <= coloc.dateSortie;

          if (hasEntered && hasNotLeft) {
            activeDaysInMonth++;
          }
          current.setDate(current.getDate() + 1);
        }

        parts.push({
          colocId: coloc.id,
          nomComplet: `${coloc.prenom} ${coloc.nom}`,
          joursPresence: activeDaysInMonth,
          montantDu: 0,
          avanceDue: Math.round((activeDaysInMonth * (currentAvanceMensuelle / daysInMonth)) * 100) / 100,
          solde: 0
        });

        totalJoursColocs += activeDaysInMonth;
      });

      const tauxJournalier = totalJoursColocs > 0 ? monthlyAmount / totalJoursColocs : 0;

      const finalParts = parts.map(part => {
        const rawMontant = part.joursPresence * tauxJournalier;
        const montantDu = Math.round(rawMontant * 100) / 100;
        
        const avanceDue = part.avanceDue || 0;
        const solde = Math.round((montantDu - avanceDue) * 100) / 100;

        if (cumulsColocsMap[part.colocId]) {
          cumulsColocsMap[part.colocId].totalDu += montantDu;
          cumulsColocsMap[part.colocId].totalJours += part.joursPresence;
          cumulsColocsMap[part.colocId].totalAvances += avanceDue;
        }

        return {
          ...part,
          montantDu,
          solde
        };
      });

      const totalCalculeMois = finalParts.reduce((sum, p) => sum + p.montantDu, 0);
      const ecartMois = monthlyAmount - totalCalculeMois;

      if (Math.abs(ecartMois) > 0 && Math.abs(ecartMois) < 1 && finalParts.length > 0) {
        const indexMax = finalParts.reduce(
          (maxIdx, part, idx, arr) => (part.joursPresence > arr[maxIdx].joursPresence ? idx : maxIdx),
          0
        );
        if (finalParts[indexMax] && finalParts[indexMax].joursPresence > 0) {
          const partAjustee = finalParts[indexMax];
          const ancienMontant = partAjustee.montantDu;
          partAjustee.montantDu = Math.round((ancienMontant + ecartMois) * 100) / 100;
          partAjustee.solde = Math.round((partAjustee.montantDu - (partAjustee.avanceDue || 0)) * 100) / 100;

          if (cumulsColocsMap[partAjustee.colocId]) {
            cumulsColocsMap[partAjustee.colocId].totalDu += (partAjustee.montantDu - ancienMontant);
          }
        }
      }

      repartitionsMensuelles.push({
        numeroMois: m,
        nomMois: NOMS_MOIS[m],
        montantGlobalMois: monthlyAmount,
        totalJoursColocs,
        tauxJournalier,
        daysInMonth,
        parts: finalParts
      });
    }

    const cumulsAnnuels: CumulAnnuelColoc[] = Object.keys(cumulsColocsMap).map(colocId => {
      const totalDu = Math.round(cumulsColocsMap[colocId].totalDu * 100) / 100;
      const totalAvances = Math.round(cumulsColocsMap[colocId].totalAvances * 100) / 100;
      const soldeAnnuel = Math.round((totalDu - totalAvances) * 100) / 100;

      return {
        colocId,
        nomComplet: cumulsColocsMap[colocId].nomComplet,
        totalDu,
        totalJoursPresence: cumulsColocsMap[colocId].totalJours,
        totalAvances,
        soldeAnnuel
      };
    });

    return {
      repartitionsMensuelles,
      cumulsAnnuels
    };
  };

  const currentResult = performAnnualCalculation();

  // --- CRUD Colocataires ---
  const handleSaveColoc = (colocData: Omit<Colocataire, 'id'>, id: string | null) => {
    let updatedColocs: Colocataire[];

    if (id) {
      updatedColocs = colocataires.map(c => 
        c.id === id 
          ? { ...c, ...colocData } 
          : c
      );
      showToast('Colocataire mis à jour');
    } else {
      const newColoc: Colocataire = {
        id: `coloc-${Date.now()}`,
        ...colocData
      };
      updatedColocs = [...colocataires, newColoc];
      showToast('Colocataire enregistré');
    }

    setColocataires(updatedColocs);
    localStorage.setItem('coloc_colocataires', JSON.stringify(updatedColocs));
    syncToSupabase(updatedColocs, calculsAnnuels);
  };

  const handleDeleteColoc = (id: string, name: string) => {
    if (window.confirm(`Voulez-vous vraiment supprimer ${name} ?`)) {
      const updated = colocataires.filter(c => c.id !== id);
      setColocataires(updated);
      localStorage.setItem('coloc_colocataires', JSON.stringify(updated));
      showToast('Colocataire supprimé');
      syncToSupabase(updated, calculsAnnuels);
    }
  };

  // --- Sauvegarde des calculs ---
  const handleSaveCalculation = () => {
    if (!currentResult || parseFloat(montantGlobalAnnuel) <= 0) {
      showToast('Montant annuel invalide');
      return;
    }

    const totalJoursTousColocs = currentResult.cumulsAnnuels.reduce((sum, c) => sum + c.totalJoursPresence, 0);
    if (totalJoursTousColocs === 0) {
      showToast('Aucun colocataire présent sur toute l\'année');
      return;
    }

    const nouveauCalcul: CalculAnnuel = {
      id: `calc-annuel-${Date.now()}`,
      annee: selectedYear,
      titre: calculDescription.trim() || `Charges Annuelles ${selectedYear}`,
      montantGlobalAnnuel: parseFloat(montantGlobalAnnuel),
      dateCalcul: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      repartitionsMensuelles: currentResult.repartitionsMensuelles,
      cumulsAnnuels: currentResult.cumulsAnnuels.filter(c => c.totalJoursPresence > 0)
    };

    const updatedCalculs = [nouveauCalcul, ...calculsAnnuels];
    setCalculsAnnuels(updatedCalculs);
    localStorage.setItem('coloc_calculs_annuels', JSON.stringify(updatedCalculs));
    showToast('Bilan annuel enregistré');
    setActiveTab('history');
    syncToSupabase(colocataires, updatedCalculs);
  };

  const handleDeleteCalcul = (id: string) => {
    if (window.confirm('Voulez-vous supprimer ce bilan de l\'historique ?')) {
      const updated = calculsAnnuels.filter(c => c.id !== id);
      setCalculsAnnuels(updated);
      localStorage.setItem('coloc_calculs_annuels', JSON.stringify(updated));
      showToast('Bilan supprimé');
      syncToSupabase(colocataires, updated);
    }
  };

  // --- Partage WhatsApp ---
  const handleShareCalcul = (calc: CalculAnnuel) => {
    let textStr = `📊 *RÉGULARISATION ANNUELLE DES CHARGES (${calc.annee})*\n`;
    textStr += `🏷️ *Libellé :* ${calc.titre}\n`;
    textStr += `💰 *Budget Annuel Réel :* ${calc.montantGlobalAnnuel.toFixed(2)} €\n`;
    textStr += `-----------------------------------\n`;
    textStr += `*BILAN PAR COLOCATAIRE :*\n\n`;

    calc.cumulsAnnuels.forEach(cumul => {
      const totalDu = cumul.totalDu;
      const totalAvances = cumul.totalAvances || 0;
      const soldeAnnuel = cumul.soldeAnnuel || 0;
      const soldeSign = soldeAnnuel > 0 
        ? `⚠️ Reste à payer : +${soldeAnnuel.toFixed(2)}` 
        : `✅ Trop-perçu à rembourser : ${soldeAnnuel.toFixed(2)}`;

      textStr += `👤 *${cumul.nomComplet}*\n`;
      textStr += `📅 Présence : ${cumul.totalJoursPresence} jours\n`;
      textStr += `💵 Part réelle due : ${totalDu.toFixed(2)} €\n`;
      textStr += `📥 Avances versées : ${totalAvances.toFixed(2)} €\n`;
      textStr += `⚖️ *Solde : ${soldeSign} €*\n\n`;
    });

    textStr += `-----------------------------------\n`;
    textStr += `_Calculé avec Gestion Coloc 🚀_`;

    navigator.clipboard.writeText(textStr)
      .then(() => showToast('Récapitulatif de régularisation copié dans le presse-papiers !'))
      .catch(() => showToast('Erreur lors de la copie'));
  };


  return (
    <div className={`phone-container ${layoutMode === 'fullscreen' ? 'fullscreen-layout' : ''}`}>
      {/* --- En-tête global de l'application --- */}
      <header className="app-header">
        {/* ========================================================
            RETOUR À L'ACCUEIL AU CLIC SUR LE LOGO / TITRE
           ======================================================== */}
        <div 
          className="app-title" 
          onClick={() => setActiveTab('home')}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title="Retourner à l'accueil"
        >
          <Calculator size={24} style={{ color: 'var(--primary)' }} />
          <span>Gestion Coloc</span>
          {isSyncing && (
            <span className="sync-indicator animate-spin" title="Synchronisation en cours..." style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center' }}>
              <RefreshCw size={14} style={{ color: 'var(--primary)' }} />
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Bouton de commutation d'affichage (Plein Écran / Téléphone) */}
          <button 
            className="layout-toggle-btn" 
            onClick={toggleLayoutMode}
            title={layoutMode === 'phone' ? "Passer en plein écran PC" : "Retourner au cadre téléphone"}
            aria-label="Changer l'affichage"
          >
            {layoutMode === 'phone' ? <Monitor size={20} /> : <Smartphone size={20} />}
          </button>

          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            title={theme === 'light' ? "Passer au thème intermédiaire (Ardoise)" : theme === 'dim' ? "Passer au thème sombre" : "Passer au thème clair"}
            aria-label="Changer le thème"
          >
            {theme === 'light' && <Sun size={20} style={{ color: '#fbbf24' }} />}
            {theme === 'dim' && <SunMoon size={20} style={{ color: 'var(--primary)' }} />}
            {theme === 'dark' && <Moon size={20} style={{ color: '#a5b4fc' }} />}
          </button>
        </div>
      </header>

      {/* --- Notification Toast --- */}
      <div className={`toast ${toast.show ? 'show' : ''}`}>
        <Check size={16} />
        <span>{toast.message}</span>
      </div>

      {/* --- Corps Principal Défilant --- */}
      <main className="app-body">
        {activeTab === 'home' && (
          <Accueil 
            colocatairesCount={colocataires.filter(c => {
              const today = new Date().toISOString().split('T')[0];
              return (!c.dateSortie || today <= c.dateSortie);
            }).length}
            selectedYear={selectedYear}
            latestCalculation={calculsAnnuels.length > 0 ? calculsAnnuels[0] : null}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'colocs' && (
          <Colocataires 
            colocataires={colocataires}
            onSaveColoc={handleSaveColoc}
            onDeleteColoc={handleDeleteColoc}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'calculator' && (
          <Calculateur 
            colocataires={colocataires}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            montantGlobalAnnuel={montantGlobalAnnuel}
            setMontantGlobalAnnuel={setMontantGlobalAnnuel}
            calculDescription={calculDescription}
            setCalculDescription={setCalculDescription}
            currentResult={currentResult}
            onSaveCalculation={handleSaveCalculation}
            onNavigate={setActiveTab}
            expandedMonth={expandedMonth}
            setExpandedMonth={setExpandedMonth}
            onTriggerSync={handleTriggerSync}
          />
        )}

        {activeTab === 'history' && (
          <Historique 
            calculsAnnuels={calculsAnnuels}
            onDeleteCalcul={handleDeleteCalcul}
            onShareCalcul={handleShareCalcul}
            onNavigate={setActiveTab}
          />
        )}
      </main>

      {/* --- Barre de Navigation Basse Premium --- */}
      <nav className="app-navigation" style={{ height: '64px' }}>
        <button 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <div className="icon-wrapper" style={{ padding: '4px 14px' }}>
            <Home size={18} />
          </div>
          <span className="nav-label">Accueil</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'colocs' ? 'active' : ''}`}
          onClick={() => setActiveTab('colocs')}
        >
          <div className="icon-wrapper" style={{ padding: '4px 14px' }}>
            <Users size={18} />
          </div>
          <span className="nav-label">Colocataires</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
        >
          <div className="icon-wrapper" style={{ padding: '4px 14px' }}>
            <Calculator size={18} />
          </div>
          <span className="nav-label">Calculateur</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <div className="icon-wrapper" style={{ padding: '4px 14px' }}>
            <History size={18} />
          </div>
          <span className="nav-label">Historique</span>
        </button>
      </nav>
    </div>
  );
}
