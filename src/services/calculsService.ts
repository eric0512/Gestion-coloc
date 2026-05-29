import type { Colocataire } from '../pages/Colocataires';
import type { ChargesDetaillees } from '../pages/Calculateur';

export interface RoommateBill {
  colocId: string;
  nomComplet: string;
  joursPresence: number;
  totalDuReel: number;
  totalAvancesPayees: number;
  solde: number;
}

/**
 * Calcule le nombre de jours inclusifs entre deux dates au format YYYY-MM-DD
 */
export function getDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Détermine si une année est bissextile (366 jours) ou non (365 jours)
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Retourne le coefficient de pondération saisonnière d'une date pour une catégorie donnée.
 * Période sans chauffage : Mai (mois 5) à Octobre (mois 10) inclus.
 */
export function getSeasonalWeight(_typeCharge: keyof ChargesDetaillees, _dateStr: string): number {
  return 1.0;
}

/**
 * Calcule la somme des poids saisonniers pour tous les jours d'une période donnée.
 */
export function getPeriodTotalWeight(
  typeCharge: keyof ChargesDetaillees,
  startDateStr: string,
  endDateStr: string
): number {
  let totalWeight = 0;
  const current = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const currentDateStr = `${y}-${m}-${d}`;
    
    totalWeight += getSeasonalWeight(typeCharge, currentDateStr);
    current.setDate(current.getDate() + 1);
  }
  return totalWeight;
}

/**
 * Détermine le coût journalier d'une catégorie de charge pour un jour donné.
 * Si une facture réelle existe pour ce jour, elle est utilisée.
 * Sinon, elle est estimée par projection linéaire de la facture la plus proche,
 * ou par un tarif par défaut historique en dernier recours.
 */
export function getDailyCostEstimation(
  typeCharge: keyof ChargesDetaillees,
  targetDateStr: string,
  chargesDetaillees: ChargesDetaillees
): { cost: number; isEstimated: boolean } {
  const periods = chargesDetaillees[typeCharge] || [];

  // 1. Recherche d'une facture réelle couvrant cette journée précise
  const realPeriod = periods.find(p => 
    targetDateStr >= p.dateDebut && 
    targetDateStr <= p.dateFin
  );

  if (realPeriod) {
    const totalWeight = getPeriodTotalWeight(typeCharge, realPeriod.dateDebut, realPeriod.dateFin);
    const dayWeight = getSeasonalWeight(typeCharge, targetDateStr);
    return {
      cost: totalWeight > 0 ? (realPeriod.montant * dayWeight) / totalWeight : 0,
      isEstimated: false
    };
  }

  // 2. Mode Estimation : Projection sur la base de la facture réelle la plus récente
  const sortedPeriods = [...periods]
    .sort((a, b) => b.dateFin.localeCompare(a.dateFin)); // Plus récente d'abord

  if (sortedPeriods.length > 0) {
    const latestPeriod = sortedPeriods[0];
    const totalWeight = getPeriodTotalWeight(typeCharge, latestPeriod.dateDebut, latestPeriod.dateFin);
    const baseWinterDailyCost = totalWeight > 0 ? latestPeriod.montant / totalWeight : 0;
    const dayWeight = getSeasonalWeight(typeCharge, targetDateStr);
    return {
      cost: baseWinterDailyCost * dayWeight,
      isEstimated: true
    };
  }

  // 3. Fallback ultime si aucune facture historique n'est encore saisie dans l'application
  const DEFAULT_DAILY_COSTS: Record<keyof ChargesDetaillees, number> = {
    gaz: 4.0,         // ex: ~120€ / mois
    electricite: 3.0,  // ex: ~90€ / mois
    internet: 1.3,     // ex: ~40€ / mois
    chaudiere: 0.0,    // Révision chaudière = dépense ponctuelle, estimée à 0.0 par jour
    communes: 2.0      // ex: ~60€ / mois
  };

  const baseCost = DEFAULT_DAILY_COSTS[typeCharge] || 0;
  const dayWeight = getSeasonalWeight(typeCharge, targetDateStr);
  return {
    cost: baseCost * dayWeight,
    isEstimated: true
  };
}

/**
 * Calcule l'intégralité du bilan annuel pour une année cible.
 * Parcourt les 365/366 jours de l'année, vérifie les colocataires présents à chaque jour d'intersection
 * et répartit le coût journalier estimé ou réel au prorata exact de leur présence.
 */
export function genererBilanAnnuel(
  anneeTarget: number,
  colocataires: Colocataire[],
  chargesDetaillees: ChargesDetaillees
): {
  bilans: RoommateBill[];
  isCloturable: boolean;
  joursCouvertsSet: Record<keyof ChargesDetaillees, number>;
  totalDays: number;
} {
  const startYearStr = `${anneeTarget}-06-01`;
  const endYearStr = `${anneeTarget + 1}-05-31`;
  
  const startYear = new Date(startYearStr);
  const endYear = new Date(endYearStr);
  const totalDays = getDaysBetween(startYearStr, endYearStr);

  // Initialisation des structures de cumul des comptes
  const mappingCalcul: Record<string, { totalDu: number; jours: number; nom: string; avanceMensuelle: number }> = {};
  colocataires.forEach(c => {
    mappingCalcul[c.id] = {
      totalDu: 0,
      jours: 0,
      nom: `${c.prenom} ${c.nom}`,
      avanceMensuelle: c.avanceCharge !== undefined ? c.avanceCharge : 150
    };
  });

  // Pour suivre la couverture par factures réelles jour après jour
  const categoriesSuivies: Array<keyof ChargesDetaillees> = ['gaz', 'electricite', 'internet', 'communes'];
  const joursCouvertsUnique: Record<keyof ChargesDetaillees, Set<string>> = {
    gaz: new Set<string>(),
    electricite: new Set<string>(),
    internet: new Set<string>(),
    chaudiere: new Set<string>(),
    communes: new Set<string>()
  };

  // Parcourir chaque jour de l'année
  const currentDate = new Date(startYear.getTime());
  while (currentDate <= endYear) {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentDate.getDate()).padStart(2, '0');
    const currentDateStr = `${y}-${m}-${d}`;

    // 1. Colocataires présents ce jour-là
    const colocsPresents = colocataires.filter(c => {
      const entry = c.dateEntree;
      const exit = c.dateSortie || '9999-12-31';
      return currentDateStr >= entry && currentDateStr <= exit;
    });

    const numPresents = colocsPresents.length;

    if (numPresents > 0) {
      // 2. Évaluer le coût journalier pour chaque type de charge
      const categories: Array<keyof ChargesDetaillees> = ['gaz', 'electricite', 'internet', 'chaudiere', 'communes'];
      
      categories.forEach(type => {
        const { cost, isEstimated } = getDailyCostEstimation(type, currentDateStr, chargesDetaillees);
        
        // Si c'est une facture réelle couvrant le jour, on l'ajoute au set de couverture unique
        if (!isEstimated) {
          joursCouvertsUnique[type].add(currentDateStr);
        }

        // Répartir le coût du jour entre les colocataires présents
        const costPerPerson = cost / numPresents;
        colocsPresents.forEach(c => {
          mappingCalcul[c.id].totalDu += costPerPerson;
          
          // Suivi des jours de présence globale (utilisons 'gaz' comme référence unique)
          if (type === 'gaz') {
            mappingCalcul[c.id].jours += 1;
          }
        });
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 3. Clôture autorisée si toutes les charges continues couvrent 100% de l'année (365/366 jours)
  // Note : 'chaudiere' est exclu car c'est une dépense ponctuelle (non continue)
  const isCloturable = categoriesSuivies.every(
    type => joursCouvertsUnique[type].size >= totalDays
  );

  // 4. Formater les résultats individuels
  const bilans: RoommateBill[] = Object.keys(mappingCalcul).map(colocId => {
    const data = mappingCalcul[colocId];
    const coloc = colocataires.find(c => c.id === colocId);
    
    // Calcul précis des avances selon la règle : dû complet au 5 du mois sauf si départ/arrivée ce mois-ci
    const totalAvancesPayees = coloc ? getRoommateYearlyAdvances(coloc, anneeTarget) : 0;
    const totalDuReel = Math.round(data.totalDu * 100) / 100;
    const solde = Math.round((totalDuReel - totalAvancesPayees) * 100) / 100;

    return {
      colocId,
      nomComplet: data.nom,
      joursPresence: data.jours,
      totalDuReel,
      totalAvancesPayees,
      solde
    };
  });

  const joursCouvertsSet: Record<keyof ChargesDetaillees, number> = {
    gaz: joursCouvertsUnique.gaz.size,
    electricite: joursCouvertsUnique.electricite.size,
    internet: joursCouvertsUnique.internet.size,
    chaudiere: joursCouvertsUnique.chaudiere.size,
    communes: joursCouvertsUnique.communes.size
  };

  return {
    bilans,
    isCloturable,
    joursCouvertsSet,
    totalDays
  };
}

/**
 * Calcule la somme exacte des avances pour une année donnée
 * en appliquant la règle : le coloc doit son avance au 5 du mois pour le mois complet
 * si sa date de sortie n'est pas connue (ou se situe après la fin du mois).
 */
export function getRoommateYearlyAdvances(coloc: Colocataire, year: number): number {
  let totalAdvances = 0;
  
  const splitYearMonths = [
    { y: year, m: 5 },  // Juin
    { y: year, m: 6 },  // Juillet
    { y: year, m: 7 },  // Août
    { y: year, m: 8 },  // Septembre
    { y: year, m: 9 },  // Octobre
    { y: year, m: 10 }, // Novembre
    { y: year, m: 11 }, // Décembre
    { y: year + 1, m: 0 }, // Janvier
    { y: year + 1, m: 1 }, // Février
    { y: year + 1, m: 2 }, // Mars
    { y: year + 1, m: 3 }, // Avril
    { y: year + 1, m: 4 }  // Mai
  ];

  for (const item of splitYearMonths) {
    const startDate = new Date(item.y, item.m, 1);
    const endDate = new Date(item.y, item.m + 1, 0);
    const daysInMonth = endDate.getDate();

    const formatDateStr = (d: Date) => {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${day}`;
    };

    const startOfMonthStr = formatDateStr(startDate);
    const endOfMonthStr = formatDateStr(endDate);

    // Compter les jours de présence dans ce mois
    let daysOfPresence = 0;
    const current = new Date(startDate.getTime());
    while (current <= endDate) {
      const currentStr = formatDateStr(current);
      const hasEntered = currentStr >= coloc.dateEntree;
      const hasNotLeft = !coloc.dateSortie || currentStr <= coloc.dateSortie;
      if (hasEntered && hasNotLeft) {
        daysOfPresence++;
      }
      current.setDate(current.getDate() + 1);
    }

    if (daysOfPresence > 0) {
      const avanceAmount = coloc.avanceCharge !== undefined ? coloc.avanceCharge : 150;
      const hasEnteredBeforeOrOnFirst = coloc.dateEntree <= startOfMonthStr;
      const isDepartureUnknownOrFuture = !coloc.dateSortie || coloc.dateSortie > endOfMonthStr;

      if (hasEnteredBeforeOrOnFirst && isDepartureUnknownOrFuture) {
        totalAdvances += avanceAmount;
      } else {
        totalAdvances += Math.round((daysOfPresence * (avanceAmount / daysInMonth)) * 100) / 100;
      }
    }
  }
  return Math.round(totalAdvances * 100) / 100;
}
