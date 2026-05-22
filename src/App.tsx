import { useState, useEffect } from 'react';
import { 
  Users, 
  Calculator, 
  History, 
  Moon, 
  Sun, 
  Check, 
  Home,
  Monitor,
  Smartphone
} from 'lucide-react';

import Accueil from './pages/Accueil';
import Colocataires from './pages/Colocataires';
import type { Colocataire } from './pages/Colocataires';
import Calculateur from './pages/Calculateur';
import Historique from './pages/Historique';

// --- Interfaces & Types partagés ---
export interface PartCalcul {
  colocId: string;
  nomComplet: string;
  joursPresence: number;
  montantDu: number;
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [layoutMode, setLayoutMode] = useState<'phone' | 'fullscreen'>('phone');
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  // --- Accordéon de détails mensuels ---
  const [expandedMonth, setExpandedMonth] = useState<number | null>(4); // Mai ouvert par défaut

  // --- États Saisie des Charges Annuelles ---
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [montantGlobalAnnuel, setMontantGlobalAnnuel] = useState<string>('7200'); // 7200 € / an par défaut
  const [calculDescription, setCalculDescription] = useState('Charges Annuelles Générales');

  // --- Initialisation & LocalStorage ---
  useEffect(() => {
    // Thème par défaut
    const savedTheme = localStorage.getItem('coloc_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Chargement du mode de mise en page (Plein Écran / Téléphone)
    const savedLayout = localStorage.getItem('coloc_layout_mode') as 'phone' | 'fullscreen' | null;
    if (savedLayout) {
      setLayoutMode(savedLayout);
    }

    // Chargement des colocataires
    const savedColocs = localStorage.getItem('coloc_colocataires');
    if (savedColocs) {
      setColocataires(JSON.parse(savedColocs));
    } else {
      setColocataires(SEED_COLOCATAIRES);
      localStorage.setItem('coloc_colocataires', JSON.stringify(SEED_COLOCATAIRES));
    }

    // Chargement des calculs annuels
    const savedCalculs = localStorage.getItem('coloc_calculs_annuels');
    if (savedCalculs) {
      setCalculsAnnuels(JSON.parse(savedCalculs));
    }
  }, []);

  // --- Thème ---
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('coloc_theme', nextTheme);
    showToast(`Mode ${nextTheme === 'light' ? 'clair' : 'sombre'} activé`);
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

    const formatDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const repartitionsMensuelles: RepartitionMensuelle[] = [];
    const cumulsColocsMap: { [colocId: string]: { totalDu: number; totalJours: number; nomComplet: string } } = {};

    colocataires.forEach(c => {
      cumulsColocsMap[c.id] = { totalDu: 0, totalJours: 0, nomComplet: `${c.prenom} ${c.nom}` };
    });

    for (let m = 0; m < 12; m++) {
      const startDate = new Date(selectedYear, m, 1);
      const endDate = new Date(selectedYear, m + 1, 0);
      const daysInMonth = endDate.getDate();

      const parts: PartCalcul[] = [];
      let totalJoursColocs = 0;

      colocataires.forEach(coloc => {
        let activeDaysInMonth = 0;

        const current = new Date(startDate.getTime());
        while (current <= endDate) {
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
          montantDu: 0
        });

        totalJoursColocs += activeDaysInMonth;
      });

      const tauxJournalier = totalJoursColocs > 0 ? monthlyAmount / totalJoursColocs : 0;

      const finalParts = parts.map(part => {
        const rawMontant = part.joursPresence * tauxJournalier;
        const montantDu = Math.round(rawMontant * 100) / 100;
        
        if (cumulsColocsMap[part.colocId]) {
          cumulsColocsMap[part.colocId].totalDu += montantDu;
          cumulsColocsMap[part.colocId].totalJours += part.joursPresence;
        }

        return {
          ...part,
          montantDu
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

    const cumulsAnnuels: CumulAnnuelColoc[] = Object.keys(cumulsColocsMap).map(colocId => ({
      colocId,
      nomComplet: cumulsColocsMap[colocId].nomComplet,
      totalDu: Math.round(cumulsColocsMap[colocId].totalDu * 100) / 100,
      totalJoursPresence: cumulsColocsMap[colocId].totalJours
    }));

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
  };

  const handleDeleteColoc = (id: string, name: string) => {
    if (window.confirm(`Voulez-vous vraiment supprimer ${name} ?`)) {
      const updated = colocataires.filter(c => c.id !== id);
      setColocataires(updated);
      localStorage.setItem('coloc_colocataires', JSON.stringify(updated));
      showToast('Colocataire supprimé');
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
  };

  const handleDeleteCalcul = (id: string) => {
    if (window.confirm('Voulez-vous supprimer ce bilan de l\'historique ?')) {
      const updated = calculsAnnuels.filter(c => c.id !== id);
      setCalculsAnnuels(updated);
      localStorage.setItem('coloc_calculs_annuels', JSON.stringify(updated));
      showToast('Bilan supprimé');
    }
  };

  // --- Partage WhatsApp ---
  const handleShareCalcul = (calc: CalculAnnuel) => {
    let textStr = `📊 *RAPPORT ANNUEL DES CHARGES (${calc.annee})*\n`;
    textStr += `🏷️ *Libellé :* ${calc.titre}\n`;
    textStr += `💰 *Budget Annuel :* ${calc.montantGlobalAnnuel.toFixed(2)} €\n`;
    textStr += `│  Soit ${(calc.montantGlobalAnnuel / 12).toFixed(2)} € / mois répartis au jour le jour\n`;
    textStr += `-----------------------------------\n`;
    textStr += `*CUMUL ANNUEL DÛ PAR COLOCATAIRE :*\n`;

    calc.cumulsAnnuels.forEach(cumul => {
      textStr += `👤 *${cumul.nomComplet}* : ${cumul.totalJoursPresence} jours de présence ➔ *${cumul.totalDu.toFixed(2)} €*\n`;
    });

    textStr += `-----------------------------------\n`;
    textStr += `_Calculé avec ColocManager 🚀_`;

    navigator.clipboard.writeText(textStr)
      .then(() => showToast('Récapitulatif annuel copié dans le presse-papiers !'))
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
          <span>ColocManager</span>
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
            aria-label="Changer le thème"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
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
