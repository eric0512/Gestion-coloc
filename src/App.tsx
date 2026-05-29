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
  FileSpreadsheet,
  Printer
} from 'lucide-react';

import Accueil from './pages/Accueil';
import Colocataires from './pages/Colocataires';
import type { Colocataire } from './pages/Colocataires';
import Calculateur from './pages/Calculateur';
import type { ChargesDetaillees } from './pages/Calculateur';
import Regularisation from './pages/Regularisation';
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
  const [activeTab, setActiveTab] = useState<'home' | 'colocs' | 'calculator' | 'regularisation' | 'history'>('home');
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

  // --- États & Handlers pour l'édition de quittances de loyer ---
  const [quittanceYear, setQuittanceYear] = useState<number>(2026);
  const [quittanceMonth, setQuittanceMonth] = useState<number>(new Date().getMonth());
  const [quittanceType, setQuittanceType] = useState<'simple' | 'regul' | 'depart'>('simple');

  const getMonthlyChargesDetails = (colocId: string, monthIndex: number) => {
    let chargeReelle = 0;
    let avanceDue = 0;
    let cumulCharges = 0;
    let cumulAvances = 0;

    if (!currentResult) return { chargeReelle, avanceDue, cumulCharges, cumulAvances };

    const rep = currentResult.repartitionsMensuelles[monthIndex];
    if (rep) {
      const part = rep.parts.find((p: any) => p.colocId === colocId);
      if (part) {
        let cumDuPrev = 0;
        let cumAvancePrev = 0;
        
        if (monthIndex > 0) {
          const prevRep = currentResult.repartitionsMensuelles[monthIndex - 1];
          const prevPart = prevRep.parts.find((p: any) => p.colocId === colocId);
          if (prevPart) {
            cumDuPrev = prevPart.montantDu;
            cumAvancePrev = prevPart.avanceDue || 0;
          }
        }
        
        chargeReelle = Math.round((part.montantDu - cumDuPrev) * 100) / 100;
        avanceDue = Math.round(((part.avanceDue || 0) - cumAvancePrev) * 100) / 100;
        cumulCharges = part.montantDu;
        cumulAvances = part.avanceDue || 0;
      }
    }
    
    return { chargeReelle, avanceDue, cumulCharges, cumulAvances };
  };

  const getActiveColocatairesForMonth = (year: number, monthIndex: number) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startOfMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${daysInMonth}`;

    const isYearRegularized = calculsAnnuels.some(c => Number(c.annee) === Number(year));

    return colocataires.filter(coloc => {
      const hasEntered = coloc.dateEntree <= endOfMonthStr;
      const hasNotLeft = !coloc.dateSortie || coloc.dateSortie >= startOfMonthStr;
      const isActiveThisMonth = hasEntered && hasNotLeft;

      if (!isYearRegularized) {
        const startOfYearStr = `${year}-01-01`;
        const endOfYearStr = `${year}-12-31`;
        const wasPresentThisYear = coloc.dateEntree <= endOfYearStr && (!coloc.dateSortie || coloc.dateSortie >= startOfYearStr);
        const hasEnteredBeforeOrDuringMonth = coloc.dateEntree <= endOfMonthStr;
        return wasPresentThisYear && hasEnteredBeforeOrDuringMonth;
      }

      return isActiveThisMonth;
    });
  };

  const handlePrintQuittance = (coloc: Colocataire, year: number, monthIndex: number, type: 'simple' | 'regul' | 'depart' = 'simple') => {
    const isRegulChecked = type === 'regul' || type === 'depart';
    const monthName = NOMS_MOIS[monthIndex];
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    // Calculer les jours de présence
    let presenceDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDayStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasEntered = currentDayStr >= coloc.dateEntree;
      const hasNotLeft = !coloc.dateSortie || currentDayStr <= coloc.dateSortie;
      if (hasEntered && hasNotLeft) {
        presenceDays++;
      }
    }

    if (presenceDays === 0 && type === 'simple') {
      alert("Ce colocataire n'était pas présent ce mois-ci. Veuillez choisir 'Quittances avec régularisation' ou 'Quittances de départ' pour imprimer son reçu.");
      return;
    }

    const rawLoyer = coloc.loyer !== undefined ? coloc.loyer : 0;
    const rawCharges = coloc.avanceCharge !== undefined ? coloc.avanceCharge : 150;

    let loyerDu = rawLoyer;
    let chargesDue = rawCharges;

    if (presenceDays < daysInMonth) {
      loyerDu = Math.round((presenceDays * (rawLoyer / daysInMonth)) * 100) / 100;
      chargesDue = Math.round((presenceDays * (rawCharges / daysInMonth)) * 100) / 100;
    }

    const { avanceDue, cumulCharges, cumulAvances } = getMonthlyChargesDetails(coloc.id, monthIndex);
    const soldeRegul = Math.round((cumulCharges - cumulAvances) * 100) / 100;

    const totalDu = isRegulChecked
      ? Math.round((loyerDu + avanceDue + soldeRegul) * 100) / 100
      : Math.round((loyerDu + chargesDue) * 100) / 100;

    const generationDateStr = new Date().toLocaleDateString('fr-FR');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le bloqueur de fenêtres pop-up empêche l'ouverture de la quittance. Veuillez autoriser les pop-ups pour ce site.");
      return;
    }

    const docTitle = type === 'simple' 
      ? `Quittance de Loyer` 
      : type === 'regul' 
        ? `Quittance de Loyer & Régularisation` 
        : `Quittance de Loyer de Départ`;

    const docSubtitle = type === 'simple'
      ? `Document officiel`
      : type === 'regul'
        ? `Document officiel avec régularisation`
        : `Solde de tout compte et régularisation`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${docTitle} - ${coloc.prenom} ${coloc.nom}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 11px;
            line-height: 1.35;
          }
          .container {
            max-width: 700px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 20px;
            box-sizing: border-box;
            background-color: #ffffff;
            height: 125mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid ${type === 'depart' ? '#be185d' : '#3b82f6'};
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .header-left h1 {
            font-size: 16px;
            color: ${type === 'depart' ? '#be185d' : '#1d4ed8'};
            margin: 0 0 2px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-left p {
            margin: 0;
            color: #64748b;
            font-size: 9px;
          }
          .header-right {
            text-align: right;
            font-size: 9px;
            color: #475569;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 8px;
          }
          .info-block {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .info-block h3 {
            margin: 0 0 4px 0;
            color: #1e293b;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
          }
          .info-block p {
            margin: 1px 0;
            color: #334155;
            font-size: 10px;
          }
          .declaration {
            background-color: ${type === 'depart' ? '#fdf2f8' : '#eff6ff'};
            border: 1px solid ${type === 'depart' ? '#fbcfe8' : '#bfdbfe'};
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 8px;
            font-style: italic;
            color: ${type === 'depart' ? '#9d174d' : '#1e3a8a'};
            font-size: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }
          th {
            background-color: ${type === 'depart' ? '#be185d' : '#1d4ed8'};
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 6px 8px;
            font-size: 10px;
            text-transform: uppercase;
          }
          td {
            padding: 4px 8px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
            font-size: 10px;
          }
          .total-row {
            font-weight: 700;
            background-color: #f1f5f9;
          }
          .total-row td {
            border-bottom: 1.5px solid #cbd5e1;
            border-top: 1.5px solid #cbd5e1;
            color: #0f172a;
            font-size: 11px;
          }
          .signature-section {
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            width: 220px;
            height: 75px;
            padding: 6px 10px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-size: 8px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
          }
          .sig-line {
            border-top: 1px solid #cbd5e1;
            margin-top: 3px;
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
          }
          .footer {
            margin-top: 4px;
            text-align: center;
            color: #94a3b8;
            font-size: 8px;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
          }
          .print-btn-container {
            margin-bottom: 20px;
            display: flex;
            justify-content: flex-end;
          }
          .print-btn {
            background-color: ${type === 'depart' ? '#be185d' : '#1d4ed8'};
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
            background-color: ${type === 'depart' ? '#9d174d' : '#1e40af'};
          }
          @media print {
            .print-btn-container {
              display: none;
            }
            .container {
              border: none;
              box-shadow: none;
              padding: 0;
            }
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">🖨️ Imprimer la Quittance</button>
        </div>
        <div class="container">
          <div class="header">
            <div class="header-left">
              <h1>${docTitle}</h1>
              <p>${docSubtitle}</p>
            </div>
            <div class="header-right">
              <strong>Date d'édition :</strong> ${generationDateStr}<br/>
              <strong>Période :</strong> du 01/${String(monthIndex + 1).padStart(2, '0')}/${year} au ${daysInMonth}/${String(monthIndex + 1).padStart(2, '0')}/${year}
            </div>
          </div>

          ${type === 'simple' 
            ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
              <div>
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Locataire :</span>
                <span style="font-size: 13px; font-weight: bold; color: #0f172a; margin-left: 8px;">${coloc.prenom.toUpperCase()} ${coloc.nom.toUpperCase()}</span>
              </div>
              <div>
                <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Date d'entrée :</span>
                <span style="font-size: 11px; font-weight: bold; color: #334155; margin-left: 8px;">${new Date(coloc.dateEntree).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
            `
            : `
            <div class="meta-info">
              <div class="info-block">
                <h3>Bailleur (Propriétaire)</h3>
                <p><strong>Nom :</strong> Propriétaire de la Colocation</p>
                <p><strong>Adresse :</strong> Adresse de la Colocation</p>
              </div>
              <div class="info-block">
                <h3>Locataire (Colocataire)</h3>
                <p><strong>Nom complet :</strong> ${coloc.prenom} ${coloc.nom}</p>
                <p><strong>Date d'entrée :</strong> ${new Date(coloc.dateEntree).toLocaleDateString('fr-FR')}</p>
                ${coloc.dateSortie ? `<p><strong>Date de sortie :</strong> ${new Date(coloc.dateSortie).toLocaleDateString('fr-FR')}</p>` : ''}
              </div>
            </div>

            <div class="declaration">
              ${type === 'regul'
                ? `Je soussigné(e), propriétaire du logement désigné ci-dessus, déclare avoir reçu de la part du locataire désigné ci-dessus la somme de <strong>${totalDu.toFixed(2)} €</strong> (comprenant ${loyerDu.toFixed(2)} € de loyer principal net, ${avanceDue.toFixed(2)} € de provision pour charges pour ce mois et ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)}` : soldeRegul.toFixed(2)} € au titre de la régularisation des charges réelles cumulées) au titre du loyer et des charges pour le mois de <strong>${monthName} ${year}</strong>. <br/><br/>
                   À la date d'édition de cette quittance, l'état récapitulatif des charges cumulées sur la période d'occupation est le suivant :
                   <ul>
                     <li><strong>Montant total des charges réelles :</strong> ${cumulCharges.toFixed(2)} €</li>
                     <li><strong>Total des charges réglées (provisions versées) :</strong> ${cumulAvances.toFixed(2)} €</li>
                     <li><strong>Solde cumulé de régularisation :</strong> ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)}` : soldeRegul.toFixed(2)} €</li>
                   </ul>
                   Cette quittance libère le locataire de tout paiement pour la période susmentionnée.`
                : `Je soussigné(e), propriétaire du logement désigné ci-dessus, déclare avoir reçu de la part du locataire désigné ci-dessus la somme de <strong>${totalDu.toFixed(2)} €</strong> (comprenant ${loyerDu.toFixed(2)} € de loyer principal net au prorata de sa présence, ${avanceDue.toFixed(2)} € de provision pour charges pour ce mois et ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)}` : soldeRegul.toFixed(2)} € au titre de la régularisation définitive des charges réelles cumulées). <br/><br/>
                   Cette quittance est délivrée pour solde de tout compte et libère définitivement le locataire de toute obligation relative aux loyers et charges pour l'intégralité de sa période d'occupation.`
              }
            </div>
            `
          }

          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th style="text-align: right;">Montant (€)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Loyer principal net (Hors charges)</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${loyerDu.toFixed(2)} €</td>
              </tr>
              ${isRegulChecked ? `
              <tr>
                <td><strong>Provision pour charges payée (ce mois)</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${avanceDue.toFixed(2)} €</td>
              </tr>
              <tr>
                <td>
                  <strong>Régularisation des charges (cumulée à ce jour)</strong><br/>
                  <small style="color: #64748b; font-size: 11px;">
                    Cumul charges réelles : ${cumulCharges.toFixed(2)} € | Cumul provisions payées : ${cumulAvances.toFixed(2)} €
                  </small>
                </td>
                <td style="text-align: right; color: ${soldeRegul > 0 ? '#b91c1c' : soldeRegul < 0 ? '#15803d' : '#334155'}; font-weight: 600;">
                  ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)} €` : `${soldeRegul.toFixed(2)} €`}
                </td>
              </tr>
              ` : `
              <tr>
                <td><strong>Provision pour charges</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${chargesDue.toFixed(2)} €</td>
              </tr>
              `}
              <tr class="total-row">
                <td><strong>Total reçu</strong></td>
                <td style="text-align: right;">${totalDu.toFixed(2)} €</td>
              </tr>
            </tbody>
          </table>

          <div class="signature-section">
            <div>
              <p style="font-size: 11px; color: #64748b; margin-bottom: 2px;"><strong>Fait à :</strong> Colocation, le ${generationDateStr}</p>
            </div>
            <div class="sig-box">
              <span class="sig-title">${type === 'depart' ? 'Signature du Locataire et Propriétaire' : 'Signature du Bailleur'}</span>
              <div class="sig-line">Signature précédée de la mention "${type === 'depart' ? 'bon pour solde de tout compte' : 'bon pour quittance'}"</div>
            </div>
          </div>

          <div class="footer">
            Cette quittance est délivrée sous réserve d'encaissement effectif du règlement. Elle ne peut en aucun cas être considérée comme une renonciation au paiement de loyers ou charges antérieurs non encore réglés.
          </div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintAllQuittances = (year: number, monthIndex: number, type: 'simple' | 'regul' | 'depart') => {
    const activeColocs = getActiveColocatairesForMonth(year, monthIndex).filter(coloc => {
      if (type === 'depart') {
        return !!coloc.dateSortie;
      }
      return !coloc.dateSortie;
    });

    if (activeColocs.length === 0) {
      alert("Aucun colocataire à imprimer pour cette période.");
      return;
    }

    const generationDateStr = new Date().toLocaleDateString('fr-FR');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le bloqueur de fenêtres pop-up empêche l'ouverture. Veuillez autoriser les pop-ups.");
      return;
    }

    const docTitleGlobal = type === 'simple' 
      ? `Quittances Simples` 
      : type === 'regul' 
        ? `Quittances avec Régularisation` 
        : `Quittances de Départ`;

    let bodyHtml = '';
    activeColocs.forEach((coloc, index) => {
      const isRegulChecked = type === 'regul' || type === 'depart';
      const monthName = NOMS_MOIS[monthIndex];
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      
      let presenceDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const currentDayStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasEntered = currentDayStr >= coloc.dateEntree;
        const hasNotLeft = !coloc.dateSortie || currentDayStr <= coloc.dateSortie;
        if (hasEntered && hasNotLeft) {
          presenceDays++;
        }
      }

      const rawLoyer = coloc.loyer !== undefined ? coloc.loyer : 0;
      const rawCharges = coloc.avanceCharge !== undefined ? coloc.avanceCharge : 150;

      let loyerDu = rawLoyer;
      let chargesDue = rawCharges;

      if (presenceDays < daysInMonth) {
        loyerDu = Math.round((presenceDays * (rawLoyer / daysInMonth)) * 100) / 100;
        chargesDue = Math.round((presenceDays * (rawCharges / daysInMonth)) * 100) / 100;
      }

      const { avanceDue, cumulCharges, cumulAvances } = getMonthlyChargesDetails(coloc.id, monthIndex);
      const soldeRegul = Math.round((cumulCharges - cumulAvances) * 100) / 100;

      const totalDu = isRegulChecked
        ? Math.round((loyerDu + avanceDue + soldeRegul) * 100) / 100
        : Math.round((loyerDu + chargesDue) * 100) / 100;

      const docTitle = type === 'simple' 
        ? `Quittance de Loyer` 
        : type === 'regul' 
          ? `Quittance de Loyer & Régularisation` 
          : `Quittance de Loyer de Départ`;

      const docSubtitle = type === 'simple'
        ? `Document officiel`
        : type === 'regul'
          ? `Document officiel avec régularisation`
          : `Solde de tout compte et régularisation`;

      bodyHtml += `
        <div class="quittance-card">
          <div class="header">
            <div class="header-left">
              <h1>${docTitle}</h1>
              <p>${docSubtitle}</p>
            </div>
            <div class="header-right">
              <strong>Date d'édition :</strong> ${generationDateStr}<br/>
              <strong>Période :</strong> du 01/${String(monthIndex + 1).padStart(2, '0')}/${year} au ${daysInMonth}/${String(monthIndex + 1).padStart(2, '0')}/${year}
            </div>
          </div>

          ${type === 'simple' 
            ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 15px;">
              <div>
                <span style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 600;">Locataire :</span>
                <span style="font-size: 15px; font-weight: bold; color: #0f172a; margin-left: 8px;">${coloc.prenom.toUpperCase()} ${coloc.nom.toUpperCase()}</span>
              </div>
              <div>
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Date d'entrée :</span>
                <span style="font-size: 13px; font-weight: bold; color: #334155; margin-left: 8px;">${new Date(coloc.dateEntree).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
            `
            : `
            <div class="meta-info">
              <div class="info-block">
                <h3>Bailleur (Propriétaire)</h3>
                <p><strong>Nom :</strong> Propriétaire de la Colocation</p>
                <p><strong>Adresse :</strong> Adresse de la Colocation</p>
              </div>
              <div class="info-block">
                <h3>Locataire (Colocataire)</h3>
                <p><strong>Nom complet :</strong> ${coloc.prenom} ${coloc.nom}</p>
                <p><strong>Date d'entrée :</strong> ${new Date(coloc.dateEntree).toLocaleDateString('fr-FR')}</p>
                ${coloc.dateSortie ? `<p><strong>Date de sortie :</strong> ${new Date(coloc.dateSortie).toLocaleDateString('fr-FR')}</p>` : ''}
              </div>
            </div>

            <div class="declaration">
              ${type === 'regul'
                ? `Je soussigné(e), propriétaire du logement désigné ci-dessus, déclare avoir reçu de la part du locataire désigné ci-dessus la somme de <strong>${totalDu.toFixed(2)} €</strong> (comprenant ${loyerDu.toFixed(2)} € de loyer principal net, ${avanceDue.toFixed(2)} € de provision pour charges pour ce mois et ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)}` : soldeRegul.toFixed(2)} € au titre de la régularisation des charges réelles cumulées) au titre du loyer et des charges pour le mois de <strong>${monthName} ${year}</strong>. <br/><br/>
                   À la date d'édition de cette quittance, l'état récapitulatif des charges cumulées sur la période d'occupation est le suivant :
                   <ul>
                     <li><strong>Montant total des charges réelles :</strong> ${cumulCharges.toFixed(2)} €</li>
                     <li><strong>Total des charges réglées (provisions versées) :</strong> ${cumulAvances.toFixed(2)} €</li>
                     <li><strong>Solde cumulé de régularisation :</strong> ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)}` : soldeRegul.toFixed(2)} €</li>
                   </ul>
                   Cette quittance libère le locataire de tout paiement pour la période susmentionnée.`
                : `Je soussigné(e), propriétaire du logement désigné ci-dessus, déclare avoir reçu de la part du locataire désigné ci-dessus la somme de <strong>${totalDu.toFixed(2)} €</strong> (comprenant ${loyerDu.toFixed(2)} € de loyer principal net au prorata de sa présence, ${avanceDue.toFixed(2)} € de provision pour charges pour ce mois et ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)}` : soldeRegul.toFixed(2)} € au titre de la régularisation définitive des charges réelles cumulées). <br/><br/>
                   Cette quittance est délivrée pour solde de tout compte et libère définitivement le locataire de toute obligation relative aux loyers et charges pour l'intégralité de sa période d'occupation.`
              }
            </div>
            `
          }

          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th style="text-align: right;">Montant (€)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Loyer principal net (Hors charges)</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${loyerDu.toFixed(2)} €</td>
              </tr>
              ${isRegulChecked ? `
              <tr>
                <td><strong>Provision pour charges payée (ce mois)</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${avanceDue.toFixed(2)} €</td>
              </tr>
              <tr>
                <td>
                  <strong>Régularisation des charges (cumulée à ce jour)</strong><br/>
                  <small style="color: #64748b; font-size: 11px;">
                    Cumul charges réelles : ${cumulCharges.toFixed(2)} € | Cumul provisions payées : ${cumulAvances.toFixed(2)} €
                  </small>
                </td>
                <td style="text-align: right; color: ${soldeRegul > 0 ? '#b91c1c' : soldeRegul < 0 ? '#15803d' : '#334155'}; font-weight: 600;">
                  ${soldeRegul > 0 ? `+${soldeRegul.toFixed(2)} €` : `${soldeRegul.toFixed(2)} €`}
                </td>
              </tr>
              ` : `
              <tr>
                <td><strong>Provision pour charges</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${chargesDue.toFixed(2)} €</td>
              </tr>
              `}
              <tr class="total-row">
                <td><strong>Total reçu</strong></td>
                <td style="text-align: right;">${totalDu.toFixed(2)} €</td>
              </tr>
            </tbody>
          </table>

          <div class="signature-section">
            <div>
              <p style="font-size: 11px; color: #64748b; margin-bottom: 2px;"><strong>Fait à :</strong> Colocation, le ${generationDateStr}</p>
            </div>
            <div class="sig-box">
              <span class="sig-title">${type === 'depart' ? 'Signature du Locataire et Propriétaire' : 'Signature du Bailleur'}</span>
              <div class="sig-line">Signature précédée de la mention "${type === 'depart' ? 'bon pour solde de tout compte' : 'bon pour quittance'}"</div>
            </div>
          </div>

          <div class="footer">
            Cette quittance est délivrée sous réserve d'encaissement effectif du règlement. Elle ne peut en aucun cas être considérée comme une renonciation au paiement de loyers ou charges antérieurs non encore réglés.
          </div>
        </div>
        ${index % 2 === 1 && index !== activeColocs.length - 1 ? '<div class="page-break"></div>' : ''}
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${docTitleGlobal} - ${activeColocs.length} colocataires</title>
        <style>
          @page {
            size: A4;
            margin: 5mm 10mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.35;
          }
          .quittance-card {
            max-width: 700px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 20px;
            box-sizing: border-box;
            background-color: #ffffff;
            height: 125mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid ${type === 'depart' ? '#be185d' : '#3b82f6'};
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .header-left h1 {
            font-size: 16px;
            color: ${type === 'depart' ? '#be185d' : '#1d4ed8'};
            margin: 0 0 2px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-left p {
            margin: 0;
            color: #64748b;
            font-size: 9px;
          }
          .header-right {
            text-align: right;
            font-size: 9px;
            color: #475569;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 8px;
          }
          .info-block {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .info-block h3 {
            margin: 0 0 4px 0;
            color: #1e293b;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
          }
          .info-block p {
            margin: 1px 0;
            color: #334155;
            font-size: 10px;
          }
          .declaration {
            background-color: ${type === 'depart' ? '#fdf2f8' : '#eff6ff'};
            border: 1px solid ${type === 'depart' ? '#fbcfe8' : '#bfdbfe'};
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 8px;
            font-style: italic;
            color: ${type === 'depart' ? '#9d174d' : '#1e3a8a'};
            font-size: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }
          th {
            background-color: ${type === 'depart' ? '#be185d' : '#1d4ed8'};
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 6px 8px;
            font-size: 10px;
            text-transform: uppercase;
          }
          td {
            padding: 4px 8px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
            font-size: 10px;
          }
          .total-row {
            font-weight: 700;
            background-color: #f1f5f9;
          }
          .total-row td {
            border-bottom: 1.5px solid #cbd5e1;
            border-top: 1.5px solid #cbd5e1;
            color: #0f172a;
            font-size: 11px;
          }
          .signature-section {
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            width: 220px;
            height: 75px;
            padding: 6px 10px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-size: 8px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
          }
          .sig-line {
            border-top: 1px solid #cbd5e1;
            margin-top: 3px;
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
          }
          .footer {
            margin-top: 4px;
            text-align: center;
            color: #94a3b8;
            font-size: 8px;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
          }
          .print-btn-container {
            margin-bottom: 20px;
            display: flex;
            justify-content: flex-end;
          }
          .print-btn {
            background-color: #1d4ed8;
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
            background-color: #1e40af;
          }
          @media print {
            .print-btn-container {
              display: none;
            }
            body {
              padding: 0;
              margin: 0;
            }
            .quittance-card {
              height: 125mm;
              page-break-inside: avoid;
              break-inside: avoid;
              border-bottom: 2px dashed #94a3b8;
              padding-bottom: 5mm;
              margin-bottom: 5mm;
              box-sizing: border-box;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">🖨️ Imprimer les ${activeColocs.length} Quittances</button>
        </div>
        ${bodyHtml}
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
    let chargesDetaillees: ChargesDetaillees = { gaz: [], electricite: [], internet: [], chaudiere: [], communes: [] };
    if (savedCharges) {
      try {
        const parsed = JSON.parse(savedCharges);
        if (parsed.autres && !parsed.internet) {
          parsed.internet = parsed.autres;
          delete parsed.autres;
        }
        if (!parsed.chaudiere) parsed.chaudiere = [];
        chargesDetaillees = parsed;
      } catch (e) {}
    }

    const allPeriods = [
      ...(chargesDetaillees.gaz || []).map(p => ({ ...p, category: 'gaz' })),
      ...(chargesDetaillees.electricite || []).map(p => ({ ...p, category: 'electricite' })),
      ...(chargesDetaillees.internet || []).map(p => ({ ...p, category: 'internet' })),
      ...(chargesDetaillees.chaudiere || []).map(p => ({ ...p, category: 'chaudiere' })),
      ...(chargesDetaillees.communes || []).map(p => ({ ...p, category: 'communes' }))
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

    // Calculate cost per day for each period based on seasonal weighting
    const activePeriods = allPeriods.map(p => {
      let totalWeight = 0;
      const current = new Date(p.dateDebut);
      const end = new Date(p.dateFin);
      while (current <= end) {
        let weight = 1.0;
        totalWeight += weight;
        current.setDate(current.getDate() + 1);
      }

      const baseDailyCost = totalWeight > 0 ? p.montant / totalWeight : 0;
      return {
        ...p,
        baseDailyCost,
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
          avanceDue: (() => {
            const startDateStr = formatDateString(startDate);
            const endOfMonthStr = formatDateString(endDate);
            const hasEnteredBeforeOrOnFirst = coloc.dateEntree <= startDateStr;
            const isDepartureUnknownOrFuture = !coloc.dateSortie || coloc.dateSortie > endOfMonthStr;
            
            const avanceAmount = coloc.avanceCharge !== undefined ? coloc.avanceCharge : 150;
            if (hasEnteredBeforeOrOnFirst && isDepartureUnknownOrFuture) {
              return avanceAmount;
            } else {
              return Math.round((activeDaysInMonth * (avanceAmount / daysInMonth)) * 100) / 100;
            }
          })(),
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
        const costOnDay = activePeriodsOnDay.reduce((sum, p) => {
          let weight = 1.0;
          return sum + p.baseDailyCost * weight;
        }, 0);

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
        monthlyBudgetReel += activePeriodsOnDay.reduce((sum, p) => {
          let weight = 1.0;
          return sum + p.baseDailyCost * weight;
        }, 0);
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

        {activeTab === 'regularisation' && (
          <Regularisation 
            colocataires={colocataires}
            calculsAnnuels={calculsAnnuels}
            setCalculsAnnuels={setCalculsAnnuels}
            onNavigate={setActiveTab}
            showToast={showToast}
            onTriggerSync={handleTriggerSync}
            currentResult={currentResult}
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
          className={`nav-item ${activeTab === 'regularisation' ? 'active' : ''}`}
          onClick={() => setActiveTab('regularisation')}
        >
          <div className="icon-wrapper" style={{ padding: '4px 14px' }}>
            <FileSpreadsheet size={18} />
          </div>
          <span className="nav-label">Régularisation</span>
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
              {/* SECTION GÉNÉRATION DES QUITTANCES DE LOYER DANS LE BILAN GLOBAL */}
              <div className="card" style={{ marginBottom: '20px', padding: '16px', borderLeft: '4px solid var(--primary)', backgroundColor: 'var(--input-bg)' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '15px' }}>
                  <Printer size={16} style={{ color: 'var(--primary)' }} />
                  <span>Édition des Quittances de Loyer</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  {/* Sélectionner l'année */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Année</label>
                    <select 
                      className="input-field" 
                      style={{ padding: '6px 10px', fontSize: '13px', height: '34px' }}
                      value={quittanceYear}
                      onChange={(e) => setQuittanceYear(parseInt(e.target.value) || 2026)}
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

                  {/* Sélectionner le mois */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Mois</label>
                    <select 
                      className="input-field" 
                      style={{ padding: '6px 10px', fontSize: '13px', height: '34px' }}
                      value={quittanceMonth}
                      onChange={(e) => setQuittanceMonth(parseInt(e.target.value) || 0)}
                    >
                      {NOMS_MOIS.map((m, idx) => (
                        <option key={idx} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Boutons d'options d'édition demandés */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setQuittanceType('simple')}
                    className="btn"
                    style={{
                      flex: 1,
                      minWidth: '90px',
                      padding: '8px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      borderRadius: 'var(--radius-md)',
                      border: quittanceType === 'simple' ? 'none' : '1px solid var(--border-color)',
                      background: quittanceType === 'simple' ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--input-bg)',
                      color: quittanceType === 'simple' ? 'var(--text-inverse)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: quittanceType === 'simple' ? '0 4px 10px rgba(79, 70, 229, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    📄 Simples
                  </button>
                  
                  <button
                    onClick={() => setQuittanceType('regul')}
                    className="btn"
                    style={{
                      flex: 1,
                      minWidth: '90px',
                      padding: '8px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      borderRadius: 'var(--radius-md)',
                      border: quittanceType === 'regul' ? 'none' : '1px solid var(--border-color)',
                      background: quittanceType === 'regul' ? 'linear-gradient(135deg, var(--secondary), #0f766e)' : 'var(--input-bg)',
                      color: quittanceType === 'regul' ? 'var(--text-inverse)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: quittanceType === 'regul' ? '0 4px 10px rgba(13, 148, 136, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ⚖️ Avec régul.
                  </button>

                  <button
                    onClick={() => setQuittanceType('depart')}
                    className="btn"
                    style={{
                      flex: 1,
                      minWidth: '90px',
                      padding: '8px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      borderRadius: 'var(--radius-md)',
                      border: quittanceType === 'depart' ? 'none' : '1px solid var(--border-color)',
                      background: quittanceType === 'depart' ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'var(--input-bg)',
                      color: quittanceType === 'depart' ? 'var(--text-inverse)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: quittanceType === 'depart' ? '0 4px 10px rgba(236, 72, 153, 0.2)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🚪 Départ
                  </button>
                </div>

                {/* Liste des colocataires actifs pour la période */}
                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Colocataires actifs en {NOMS_MOIS[quittanceMonth]} {quittanceYear} :
                    </span>
                    <button
                      onClick={() => handlePrintAllQuittances(quittanceYear, quittanceMonth, quittanceType)}
                      className="btn"
                      style={{
                        width: 'auto',
                        padding: '4px 8px',
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      🖨️ Imprimer Tout (2/page A4)
                    </button>
                  </div>

                  {getActiveColocatairesForMonth(quittanceYear, quittanceMonth).filter(coloc => {
                    if (quittanceType === 'depart') {
                      return !!coloc.dateSortie;
                    }
                    return !coloc.dateSortie;
                  }).length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                      {quittanceType === 'depart' 
                        ? "Aucun colocataire avec date de départ pour cette période." 
                        : "Aucun colocataire actif pour cette période."}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {getActiveColocatairesForMonth(quittanceYear, quittanceMonth)
                        .filter(coloc => {
                          if (quittanceType === 'depart') {
                            return !!coloc.dateSortie;
                          }
                          return !coloc.dateSortie;
                        })
                        .map((coloc) => {
                        // Calculer les jours de présence pour afficher le prorata éventuel
                        const daysInMonth = new Date(quittanceYear, quittanceMonth + 1, 0).getDate();
                        let presenceDays = 0;
                        for (let d = 1; d <= daysInMonth; d++) {
                          const currentDayStr = `${quittanceYear}-${String(quittanceMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const hasEntered = currentDayStr >= coloc.dateEntree;
                          const hasNotLeft = !coloc.dateSortie || currentDayStr <= coloc.dateSortie;
                          if (hasEntered && hasNotLeft) {
                            presenceDays++;
                          }
                        }
                        const isProrated = presenceDays < daysInMonth;

                        return (
                          <div 
                            key={coloc.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 10px',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                                {coloc.prenom} {coloc.nom}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                Présence : {presenceDays}/{daysInMonth} j {presenceDays === 0 ? (
                                  <span style={{ color: '#d97706', fontWeight: 600, backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '2px 4px', borderRadius: '4px', marginLeft: '4px' }}>
                                    ⚠️ Régul
                                  </span>
                                ) : isProrated ? (
                                  <span style={{ color: '#d97706', fontWeight: 600 }}>(prorata)</span>
                                ) : null}
                              </span>
                            </div>
                            <button
                              onClick={() => handlePrintQuittance(coloc, quittanceYear, quittanceMonth, quittanceType)}
                              className="btn"
                              style={{
                                width: 'auto',
                                padding: '6px 10px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                background: quittanceType === 'simple' 
                                  ? 'rgba(79, 70, 229, 0.1)' 
                                  : quittanceType === 'regul' 
                                    ? 'rgba(13, 148, 136, 0.1)' 
                                    : 'rgba(236, 72, 153, 0.1)',
                                color: quittanceType === 'simple' 
                                  ? 'var(--primary)' 
                                  : quittanceType === 'regul' 
                                    ? 'var(--secondary)' 
                                    : '#be185d',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Printer size={12} />
                              <span>
                                {quittanceType === 'simple' 
                                  ? 'Imprimer Simple' 
                                  : quittanceType === 'regul' 
                                    ? 'Imprimer Régul.' 
                                    : 'Imprimer Départ'}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Panel de diagnostic technique */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}>🔍 Diagnostic technique des colocataires ({quittanceYear})</summary>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px' }}>
                      <div><strong>Année régularisée dans l'historique :</strong> {calculsAnnuels.some(c => Number(c.annee) === Number(quittanceYear)) ? "🔴 OUI (les colocataires partis sont donc masqués)" : "🟢 NON (les colocataires partis doivent être visibles)"}</div>
                      <div style={{ marginTop: '4px' }}><strong>Détails par colocataire dans la base :</strong></div>
                      {colocataires.map(coloc => {
                        const daysInMonth = new Date(quittanceYear, quittanceMonth + 1, 0).getDate();
                        const startOfMonthStr = `${quittanceYear}-${String(quittanceMonth + 1).padStart(2, '0')}-01`;
                        const endOfMonthStr = `${quittanceYear}-${String(quittanceMonth + 1).padStart(2, '0')}-${daysInMonth}`;
                        
                        const hasEntered = coloc.dateEntree <= endOfMonthStr;
                        const hasNotLeft = !coloc.dateSortie || coloc.dateSortie >= startOfMonthStr;
                        
                        const startOfYearStr = `${quittanceYear}-01-01`;
                        const endOfYearStr = `${quittanceYear}-12-31`;
                        const wasPresentThisYear = coloc.dateEntree <= endOfYearStr && (!coloc.dateSortie || coloc.dateSortie >= startOfYearStr);
                        const hasEnteredBeforeOrDuringMonth = coloc.dateEntree <= endOfMonthStr;
                        
                        return (
                          <div key={coloc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '4px' }}>
                            <strong>{coloc.prenom} {coloc.nom} :</strong><br/>
                            • Entrée: <span style={{ color: 'var(--text-primary)' }}>{coloc.dateEntree}</span> | Sortie: <span style={{ color: 'var(--text-primary)' }}>{coloc.dateSortie || 'null'}</span><br/>
                            • Présent cette année ({quittanceYear}) : {wasPresentThisYear ? "✅ Oui" : "❌ Non"}<br/>
                            • Entré avant/pendant le mois : {hasEnteredBeforeOrDuringMonth ? "✅ Oui" : "❌ Non"}<br/>
                            • Doit être affiché : {(wasPresentThisYear && hasEnteredBeforeOrDuringMonth) ? "🟢 OUI" : "🔴 NON"}<br/>
                            • Actif ce mois-ci : {(hasEntered && hasNotLeft) ? "✅ Oui" : "❌ Non"}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>


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
