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
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';

import Accueil from './pages/Accueil';
import Colocataires from './pages/Colocataires';
import type { Colocataire } from './pages/Colocataires';
import Calculateur from './pages/Calculateur';
import type { ChargesDetaillees } from './pages/Calculateur';
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
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dim' | 'dark'>('dark');
  const [layoutMode, setLayoutMode] = useState<'phone' | 'fullscreen'>('phone');
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  // --- États de Synchronisation Supabase ---
  const [hasLoadedFromSupabase, setHasLoadedFromSupabase] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // --- États Saisie des Charges Annuelles ---
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [montantGlobalAnnuel, setMontantGlobalAnnuel] = useState<string>('7200'); // 7200 € / an par défaut

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

    // Load detailed charges from localStorage
    const savedCharges = localStorage.getItem('coloc_charges_detaillees');
    let chargesDetaillees: ChargesDetaillees = { gaz: [], electricite: [], autres: [], communes: [] };
    if (savedCharges) {
      try {
        chargesDetaillees = JSON.parse(savedCharges);
      } catch (e) {}
    }

    const allPeriods = [
      ...(chargesDetaillees.gaz || []),
      ...(chargesDetaillees.electricite || []),
      ...(chargesDetaillees.autres || []),
      ...(chargesDetaillees.communes || [])
    ];

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

    const runningCharges: { [id: string]: number } = {};
    const runningAvances: { [id: string]: number } = {};

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Calculate cost per day for each period
    const activePeriods = allPeriods.map(p => {
      const start = new Date(p.dateDebut);
      const end = new Date(p.dateFin);
      const diffTime = Math.max(0, end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const costPerDay = diffDays > 0 ? p.montant / diffDays : 0;
      return {
        ...p,
        costPerDay,
        startDate: p.dateDebut,
        endDate: p.dateFin
      };
    });

    for (let m = 0; m < 12; m++) {
      const startDate = new Date(selectedYear, m, 1);
      const endDate = new Date(selectedYear, m + 1, 0);
      const daysInMonth = endDate.getDate();

      let limitEndDate = new Date(endDate.getTime());
      if (selectedYear === currentYear) {
        if (m > currentMonth) {
          limitEndDate = new Date(selectedYear, m, 0);
        }
      } else if (selectedYear > currentYear) {
        limitEndDate = new Date(selectedYear, m, 0);
      }

      const parts: PartCalcul[] = [];
      let totalJoursColocs = 0;

      const dailyPresence: { [day: number]: string[] } = {};
      for (let day = 1; day <= daysInMonth; day++) {
        dailyPresence[day] = [];
      }

      colocataires.forEach(coloc => {
        let activeDaysInMonth = 0;
        const current = new Date(startDate.getTime());
        while (current <= limitEndDate) {
          const currentStr = formatDateString(current);
          const hasEntered = currentStr >= coloc.dateEntree;
          const hasNotLeft = !coloc.dateSortie || currentStr <= coloc.dateSortie;

          if (hasEntered && hasNotLeft) {
            activeDaysInMonth++;
            dailyPresence[current.getDate()].push(coloc.id);
          }
          current.setDate(current.getDate() + 1);
        }

        parts.push({
          colocId: coloc.id,
          nomComplet: `${coloc.prenom} ${coloc.nom}`,
          joursPresence: activeDaysInMonth,
          montantDu: 0,
          avanceDue: Math.round((activeDaysInMonth * ((coloc.avanceCharge !== undefined ? coloc.avanceCharge : 150) / daysInMonth)) * 100) / 100,
          solde: 0
        });
        totalJoursColocs += activeDaysInMonth;
      });

      const roommatesDailyAmount: { [colocId: string]: number } = {};
      colocataires.forEach(c => { roommatesDailyAmount[c.id] = 0; });

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(selectedYear, m, day);
        const currentDateStr = formatDateString(currentDate);

        if (currentDate > limitEndDate) continue;

        const activePeriodsOnDay = activePeriods.filter(p => currentDateStr >= p.startDate && currentDateStr <= p.endDate);
        const costOnDay = activePeriodsOnDay.reduce((sum, p) => sum + p.costPerDay, 0);

        const presentColocs = dailyPresence[day] || [];
        if (presentColocs.length > 0 && costOnDay > 0) {
          const costPerPerson = costOnDay / presentColocs.length;
          presentColocs.forEach(colocId => {
            roommatesDailyAmount[colocId] += costPerPerson;
          });
        }
      }

      const monthlyValues = parts.map(part => {
        const rawMontant = roommatesDailyAmount[part.colocId] || 0;
        const montantDu = Math.round(rawMontant * 100) / 100;
        const avanceDue = part.avanceDue || 0;
        return { colocId: part.colocId, montantDu, avanceDue };
      });

      let monthlyBudgetReel = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(selectedYear, m, day);
        const currentDateStr = formatDateString(currentDate);
        if (currentDate > limitEndDate) continue;
        const activePeriodsOnDay = activePeriods.filter(p => currentDateStr >= p.startDate && currentDateStr <= p.endDate);
        monthlyBudgetReel += activePeriodsOnDay.reduce((sum, p) => sum + p.costPerDay, 0);
      }
      monthlyBudgetReel = Math.round(monthlyBudgetReel * 100) / 100;

      const totalCalculeMois = monthlyValues.reduce((sum, p) => sum + p.montantDu, 0);
      const ecartMois = monthlyBudgetReel - totalCalculeMois;

      if (Math.abs(ecartMois) > 0 && Math.abs(ecartMois) < 1 && monthlyValues.length > 0) {
        const indexMax = parts.reduce((maxIdx, part, idx, arr) => (part.joursPresence > arr[maxIdx].joursPresence ? idx : maxIdx), 0);
        if (parts[indexMax] && parts[indexMax].joursPresence > 0) {
          const colocIdAjuste = parts[indexMax].colocId;
          const matchVal = monthlyValues.find(v => v.colocId === colocIdAjuste);
          if (matchVal) {
            matchVal.montantDu = Math.round((matchVal.montantDu + ecartMois) * 100) / 100;
          }
        }
      }

      const finalParts = parts.map(part => {
        const monthlyVal = monthlyValues.find(v => v.colocId === part.colocId) || { montantDu: 0, avanceDue: 0 };
        const montantDuMensuel = monthlyVal.montantDu;
        const avanceDueMensuelle = monthlyVal.avanceDue;

        if (cumulsColocsMap[part.colocId]) {
          cumulsColocsMap[part.colocId].totalDu += montantDuMensuel;
          cumulsColocsMap[part.colocId].totalJours += part.joursPresence;
          cumulsColocsMap[part.colocId].totalAvances += avanceDueMensuelle;
        }

        runningCharges[part.colocId] = (runningCharges[part.colocId] || 0) + montantDuMensuel;
        runningAvances[part.colocId] = (runningAvances[part.colocId] || 0) + avanceDueMensuelle;

        return {
          ...part,
          montantDu: Math.round(runningCharges[part.colocId] * 100) / 100,
          avanceDue: Math.round(runningAvances[part.colocId] * 100) / 100,
          solde: Math.round((runningCharges[part.colocId] - runningAvances[part.colocId]) * 100) / 100
        };
      });

      repartitionsMensuelles.push({
        numeroMois: m,
        nomMois: NOMS_MOIS[m],
        montantGlobalMois: monthlyBudgetReel,
        totalJoursColocs,
        tauxJournalier: totalJoursColocs > 0 ? monthlyBudgetReel / totalJoursColocs : 0,
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

  // --- Obtenir les cumuls de régularisation arrêtés au mois précédent ---
  const getRoommateCumulativeData = (colocId: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    let totalDu = 0;
    let totalAvances = 0;
    let soldeAnnuel = 0;
    let totalJoursPresence = 0;

    if (!currentResult) {
      return { totalDu, totalAvances, soldeAnnuel, totalJoursPresence };
    }

    if (selectedYear === currentYear) {
      // Régularisation arrêtée au mois en cours (currentMonth)
      const targetMonthIndex = currentMonth;
      
      if (targetMonthIndex >= 0 && targetMonthIndex < currentResult.repartitionsMensuelles.length) {
        const rep = currentResult.repartitionsMensuelles[targetMonthIndex];
        const part = rep.parts.find(p => p.colocId === colocId);
        if (part) {
          totalDu = part.montantDu;
          totalAvances = part.avanceDue || 0;
          soldeAnnuel = part.solde || 0;
        }
      }

      // Somme des jours de présence jusqu'au mois en cours
      for (let m = 0; m <= targetMonthIndex; m++) {
        const rep = currentResult.repartitionsMensuelles[m];
        const part = rep.parts.find(p => p.colocId === colocId);
        if (part) {
          totalJoursPresence += part.joursPresence;
        }
      }
    } else if (selectedYear < currentYear) {
      // Année passée : bilan annuel complet
      const cumul = currentResult.cumulsAnnuels.find(c => c.colocId === colocId);
      if (cumul) {
        totalDu = cumul.totalDu;
        totalAvances = cumul.totalAvances || 0;
        soldeAnnuel = cumul.soldeAnnuel || 0;
        totalJoursPresence = cumul.totalJoursPresence;
      }
    }

    return { totalDu, totalAvances, soldeAnnuel, totalJoursPresence };
  };

  // --- Génération de PDF individuel ---
  const handlePrintRoommateBill = (colocId: string) => {
    const coloc = colocataires.find(c => c.id === colocId);
    if (!coloc || !currentResult) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Récupérer les lignes de détails mensuels pour le colocataire
    const monthlyLines: {
      nomMois: string;
      daysInMonth: number;
      joursPresence: number;
      loyerDu: number;
      avanceDue: number;
      chargeDue: number;
      totalMensuel: number;
    }[] = [];

    let cumDuPrev = 0;
    let cumAvancePrev = 0;

    currentResult.repartitionsMensuelles.forEach(rep => {
      // Filtrer pour ne garder que les mois antérieurs ou égal au mois en cours si c'est l'année en cours
      if (selectedYear === currentYear && rep.numeroMois > currentMonth) {
        return;
      }

      const part = rep.parts.find(p => p.colocId === colocId);
      if (part && part.joursPresence > 0) {
        // Calcul non cumulatif (valeurs nettes du mois courant)
        const chargeDue = Math.round((part.montantDu - cumDuPrev) * 100) / 100;
        const avanceDue = Math.round(((part.avanceDue || 0) - cumAvancePrev) * 100) / 100;
        
        // Calcul du loyer proratisé au jour près
        const loyerDu = Math.round((part.joursPresence * ((coloc.loyer || 0) / rep.daysInMonth)) * 100) / 100;
        
        // Total mensuel dû (Loyer + Charges Réelles)
        const totalMensuel = Math.round((loyerDu + chargeDue) * 100) / 100;

        monthlyLines.push({
          nomMois: rep.nomMois,
          daysInMonth: rep.daysInMonth,
          joursPresence: part.joursPresence,
          loyerDu,
          avanceDue,
          chargeDue,
          totalMensuel
        });
      }

      // Conserver les cumuls du mois pour la soustraction du mois suivant
      const partForCum = rep.parts.find(p => p.colocId === colocId);
      if (partForCum) {
        cumDuPrev = partForCum.montantDu;
        cumAvancePrev = partForCum.avanceDue || 0;
      }
    });

    const totalJours = monthlyLines.reduce((sum, l) => sum + l.joursPresence, 0);
    const totalLoyer = monthlyLines.reduce((sum, l) => sum + l.loyerDu, 0);
    const totalAvances = monthlyLines.reduce((sum, l) => sum + l.avanceDue, 0);
    const totalCharges = monthlyLines.reduce((sum, l) => sum + l.chargeDue, 0);
    const totalGeneral = Math.round((totalLoyer + totalCharges) * 100) / 100;
    const soldeRegul = Math.round((totalCharges - totalAvances) * 100) / 100;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le bloqueur de fenêtres pop-up empêche l'ouverture du bilan PDF. Veuillez autoriser les pop-ups pour ce site.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Bilan Individuel de Régularisation - ${coloc.prenom} ${coloc.nom}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 14px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            font-size: 22px;
            color: #6366f1;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-block {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
          }
          .info-block h3 {
            margin: 0 0 10px 0;
            color: #334155;
            font-size: 14px;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
          }
          .info-row:last-child {
            margin-bottom: 0;
          }
          .info-label {
            color: #64748b;
            font-weight: 500;
          }
          .info-value {
            color: #0f172a;
            font-weight: 600;
          }
          .solde-badge {
            font-size: 16px;
            font-weight: 700;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
            margin-top: 10px;
          }
          .solde-rembourser {
            background-color: #d1fae5;
            color: #065f46;
            border: 1px solid #a7f3d0;
          }
          .solde-payer {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
          }
          .solde-neutre {
            background-color: #f1f5f9;
            color: #334155;
            border: 1px solid #e2e8f0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          th {
            background-color: #6366f1;
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 10px 12px;
            font-size: 13px;
            text-transform: uppercase;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          tr:hover td {
            background-color: #f8fafc;
          }
          .total-row {
            font-weight: 700;
            background-color: #f1f5f9;
          }
          .total-row td {
            border-bottom: 2px solid #cbd5e1;
            border-top: 2px solid #cbd5e1;
            color: #0f172a;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 60px;
            page-break-inside: avoid;
          }
          .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            height: 120px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-size: 12px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
          }
          .footer {
            margin-top: 80px;
            text-align: center;
            color: #94a3b8;
            font-size: 11px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
          }
          .print-btn-container {
            margin-bottom: 20px;
            display: flex;
            justify-content: flex-end;
          }
          .print-btn {
            background-color: #6366f1;
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: background-color 0.2s ease;
          }
          .print-btn:hover {
            background-color: #4f46e5;
          }
          @media print {
            .print-btn-container {
              display: none;
            }
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
        </div>

        <div class="header">
          <div>
            <h1>Régularisation des Charges</h1>
            <div style="font-size: 14px; color: #64748b; margin-top: 4px;">Gestion de Colocation - Année ${selectedYear}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; color: #0f172a; font-size: 16px;">Bilan Individuel</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 2px;">Date d'édition : ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <div class="meta-info">
          <div class="info-block">
            <h3>${coloc.prenom} ${coloc.nom}</h3>
            ${coloc.telephone ? `
            <div class="info-row">
              <span class="info-label">Téléphone :</span>
              <span class="info-value">${coloc.telephone}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Date d'entrée :</span>
              <span class="info-value">${new Date(coloc.dateEntree).toLocaleDateString('fr-FR')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date de sortie :</span>
              <span class="info-value">${coloc.dateSortie ? new Date(coloc.dateSortie).toLocaleDateString('fr-FR') : 'Présent'}</span>
            </div>
          </div>

          <div class="info-block" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3>Bilan Financier Global</h3>
              <div class="info-row">
                <span class="info-label">Présence cumulée :</span>
                <span class="info-value">${totalJours} jours</span>
              </div>
              <div class="info-row">
                <span class="info-label">Charges réelles dues :</span>
                <span class="info-value">${totalCharges.toFixed(2)} €</span>
              </div>
              <div class="info-row">
                <span class="info-label">Avances versées :</span>
                <span class="info-value">${totalAvances.toFixed(2)} €</span>
              </div>
            </div>
            
            <div class="solde-badge ${soldeRegul > 0 ? 'solde-payer' : soldeRegul < 0 ? 'solde-rembourser' : 'solde-neutre'}">
              ${soldeRegul > 0 
                ? `Reste à payer : +${soldeRegul.toFixed(2)} €` 
                : soldeRegul < 0 
                  ? `Trop-perçu à rembourser : ${Math.abs(soldeRegul).toFixed(2)} €` 
                  : 'Solde équilibré : 0.00 €'}
            </div>
          </div>
        </div>

        <h3 style="color: #334155; font-size: 15px; margin-bottom: 12px; text-transform: uppercase;">Détails mensuels de l'année ${selectedYear}</h3>
        <table>
          <thead>
            <tr>
              <th>Mois</th>
              <th style="text-align: center;">Présence</th>
              <th style="text-align: right;">Loyer dû</th>
              <th style="text-align: right;">Avance charges</th>
              <th style="text-align: right;">Loyer avec charges</th>
              <th style="text-align: right;">Charges réelles</th>
              <th style="text-align: right;">Total mensuel (Dû)</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyLines.map(line => `
              <tr>
                <td style="font-weight: 600; color: #0f172a;">${line.nomMois} ${selectedYear}</td>
                <td style="text-align: center;">${line.joursPresence} j / ${line.daysInMonth}</td>
                <td style="text-align: right; font-weight: 500;">${line.loyerDu.toFixed(2)} €</td>
                <td style="text-align: right; color: #475569;">${line.avanceDue.toFixed(2)} €</td>
                <td style="text-align: right; font-weight: 600; color: #0f172a;">${(line.loyerDu + line.avanceDue).toFixed(2)} €</td>
                <td style="text-align: right; color: #475569;">${line.chargeDue.toFixed(2)} €</td>
                <td style="text-align: right; font-weight: 600; color: #6366f1;">${line.totalMensuel.toFixed(2)} €</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>TOTAL CUMULÉ</td>
              <td style="text-align: center;">-</td>
              <td style="text-align: right;">${totalLoyer.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: normal; color: #475569;">${totalAvances.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: bold; color: #0f172a;">${(totalLoyer + totalAvances).toFixed(2)} €</td>
              <td style="text-align: right; font-weight: normal; color: #475569;">${totalCharges.toFixed(2)} €</td>
              <td style="text-align: right; color: #6366f1;">${totalGeneral.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <span class="sig-title">Signature du Colocataire</span>
            <div style="font-size: 11px; color: #94a3b8;">Bon pour accord</div>
          </div>
          <div class="sig-box">
            <span class="sig-title">Signature du Mandataire</span>
            <div style="font-size: 11px; color: #94a3b8;">Gestion Coloc</div>
          </div>
        </div>

        <div class="footer">
          Bilan de régularisation individuel généré par l'application Gestion Coloc - Merci de votre confiance.
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
            onOpenBilling={() => setShowBillingModal(true)}
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
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            montantGlobalAnnuel={montantGlobalAnnuel}
            setMontantGlobalAnnuel={setMontantGlobalAnnuel}
            onNavigate={setActiveTab}
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

      {/* --- Modal de Facturation / Bilan de Régularisation --- */}
      {showBillingModal && (
        <div className="modal-overlay" onClick={() => setShowBillingModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--secondary)' }} />
                <span>Bilan Global de Régularisation ({selectedYear})</span>
              </div>
              <button className="icon-btn" onClick={() => setShowBillingModal(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
              {(!currentResult || currentResult.cumulsAnnuels.reduce((sum, c) => sum + c.totalJoursPresence, 0) === 0) ? (
                <div className="empty-state" style={{ padding: '16px 0' }}>
                  <AlertCircle size={32} className="empty-icon" style={{ color: 'var(--danger)' }} />
                  <p className="empty-text">Aucun colocataire présent pour l'année {selectedYear}.</p>
                </div>
              ) : (
                <>
                  <p className="card-subtitle" style={{ marginBottom: '14px', lineHeight: 1.4, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Ce bilan calcule la part réelle de chacun sur le budget au prorata de leur présence cumulée sur la période (régularisation arrêtée au mois en cours).
                    <span style={{ display: 'block', marginTop: '6px', color: 'var(--primary)', fontWeight: 600 }}>
                      💡 Cliquez sur un colocataire ci-dessous pour générer son reçu PDF individuel détaillé (loyer et charges).
                    </span>
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {currentResult.cumulsAnnuels.map(cumul => {
                      // Obtenir les cumuls arrêtés au mois en cours
                      const data = getRoommateCumulativeData(cumul.colocId);
                      const solde = data.soldeAnnuel;
                      
                      return (
                        <div 
                          key={cumul.colocId}
                          onClick={() => handlePrintRoommateBill(cumul.colocId)}
                          title="Cliquez pour générer et imprimer le bilan PDF de ce colocataire"
                          style={{
                            padding: '14px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--input-bg)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                              {cumul.nomComplet}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              📅 <strong>{data.totalJoursPresence} jours</strong> de présence cumulée
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <div>
                              <span>Part due :</span>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '13px' }}>
                                {data.totalDu.toFixed(2)} €
                              </div>
                            </div>
                            <div>
                              <span>Avances payées :</span>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontSize: '13px' }}>
                                {data.totalAvances.toFixed(2)} €
                              </div>
                            </div>
                            <div>
                              <span>Solde de régul. :</span>
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
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBillingModal(false)} style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
