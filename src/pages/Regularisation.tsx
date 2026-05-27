import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Home, 
  ShieldAlert,
  Printer
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

  const NOMS_MOIS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [quittanceYear, setQuittanceYear] = useState<number>(2026);
  const [quittanceMonth, setQuittanceMonth] = useState<number>(new Date().getMonth());

  const getActiveColocatairesForMonth = (year: number, monthIndex: number) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startOfMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${daysInMonth}`;

    return colocataires.filter(coloc => {
      const hasEntered = coloc.dateEntree <= endOfMonthStr;
      const hasNotLeft = !coloc.dateSortie || coloc.dateSortie >= startOfMonthStr;
      return hasEntered && hasNotLeft;
    });
  };

  const handlePrintQuittance = (coloc: Colocataire, year: number, monthIndex: number) => {
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

    if (presenceDays === 0) return;

    const rawLoyer = coloc.loyer !== undefined ? coloc.loyer : 0;
    const rawCharges = coloc.avanceCharge !== undefined ? coloc.avanceCharge : 150;

    let loyerDu = rawLoyer;
    let chargesDue = rawCharges;

    if (presenceDays < daysInMonth) {
      loyerDu = Math.round((presenceDays * (rawLoyer / daysInMonth)) * 100) / 100;
      chargesDue = Math.round((presenceDays * (rawCharges / daysInMonth)) * 100) / 100;
    }

    const totalDu = Math.round((loyerDu + chargesDue) * 100) / 100;
    const generationDateStr = new Date().toLocaleDateString('fr-FR');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le bloqueur de fenêtres pop-up empêche l'ouverture de la quittance. Veuillez autoriser les pop-ups pour ce site.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Quittance de Loyer - ${coloc.prenom} ${coloc.nom}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 14px;
            line-height: 1.6;
          }
          .container {
            max-width: 700px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header-left h1 {
            font-size: 24px;
            color: #1d4ed8;
            margin: 0 0 5px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-left p {
            margin: 0;
            color: #64748b;
            font-size: 12px;
          }
          .header-right {
            text-align: right;
            font-size: 12px;
            color: #475569;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 35px;
          }
          .info-block {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
          }
          .info-block h3 {
            margin: 0 0 12px 0;
            color: #1e293b;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
          }
          .info-block p {
            margin: 4px 0;
            color: #334155;
          }
          .declaration {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 35px;
            font-style: italic;
            color: #1e3a8a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
          }
          th {
            background-color: #1d4ed8;
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 12px;
            font-size: 13px;
            text-transform: uppercase;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          .total-row {
            font-weight: 700;
            background-color: #f1f5f9;
          }
          .total-row td {
            border-bottom: 2px solid #cbd5e1;
            border-top: 2px solid #cbd5e1;
            color: #0f172a;
            font-size: 15px;
          }
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            width: 250px;
            height: 140px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-size: 11px;
            color: #64748b;
            font-weight: bold;
            text-transform: uppercase;
          }
          .sig-line {
            border-top: 1px solid #cbd5e1;
            margin-top: 10px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
          }
          .footer {
            margin-top: 60px;
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
              <h1>Quittance de Loyer</h1>
              <p>Document officiel attestant du paiement du loyer et des charges</p>
            </div>
            <div class="header-right">
              <strong>Date d'édition :</strong> ${generationDateStr}<br/>
              <strong>Période :</strong> du 01/${String(monthIndex + 1).padStart(2, '0')}/${year} au ${daysInMonth}/${String(monthIndex + 1).padStart(2, '0')}/${year}
            </div>
          </div>

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
            Je soussigné(e), propriétaire du logement désigné ci-dessus, déclare avoir reçu de la part du locataire désigné ci-dessus la somme de <strong>${totalDu.toFixed(2)} €</strong> au titre du loyer et de la provision pour charges pour le mois de <strong>${monthName} ${year}</strong>. Cette quittance libère le locataire de tout paiement pour la période susmentionnée.
          </div>

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
              <tr>
                <td><strong>Provision pour charges</strong> ${presenceDays < daysInMonth ? `(au prorata de ${presenceDays} jours sur ${daysInMonth})` : ''}</td>
                <td style="text-align: right;">${chargesDue.toFixed(2)} €</td>
              </tr>
              <tr class="total-row">
                <td><strong>Total reçu</strong></td>
                <td style="text-align: right;">${totalDu.toFixed(2)} €</td>
              </tr>
            </tbody>
          </table>

          <div class="signature-section">
            <div>
              <p style="font-size: 12px; color: #64748b; margin-bottom: 5px;"><strong>Fait à :</strong> Colocation, le ${generationDateStr}</p>
            </div>
            <div class="sig-box">
              <span class="sig-title">Signature du Bailleur</span>
              <div class="sig-line">Signature précédée de la mention "bon pour quittance"</div>
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

      {/* SECTION GÉNÉRATION DES QUITTANCES DE LOYER */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Printer size={16} style={{ color: 'var(--primary)' }} />
          <span>Édition des Quittances de Loyer</span>
        </div>
        <p className="card-subtitle" style={{ marginBottom: '16px' }}>
          Générez et imprimez les quittances de loyer mensuelles officielles pour vos colocataires actifs.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Sélectionner l'année */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sélectionner l'année</label>
            <select 
              className="input-field" 
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
            <label className="form-label">Sélectionner le mois</label>
            <select 
              className="input-field" 
              value={quittanceMonth}
              onChange={(e) => setQuittanceMonth(parseInt(e.target.value) || 0)}
            >
              {NOMS_MOIS.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Liste des colocataires actifs pour la période */}
        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
            Colocataires actifs en {NOMS_MOIS[quittanceMonth]} {quittanceYear} :
          </span>

          {getActiveColocatairesForMonth(quittanceYear, quittanceMonth).length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
              Aucun colocataire actif pour cette période.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getActiveColocatairesForMonth(quittanceYear, quittanceMonth).map((coloc) => {
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
                      padding: '10px 12px',
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {coloc.prenom} {coloc.nom}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Présence : {presenceDays} / {daysInMonth} jours {isProrated && <span style={{ color: '#d97706', fontWeight: 600 }}>(au prorata)</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePrintQuittance(coloc, quittanceYear, quittanceMonth)}
                      className="btn btn-secondary"
                      style={{
                        width: 'auto',
                        padding: '6px 12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      <Printer size={14} />
                      <span>Quittance</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
