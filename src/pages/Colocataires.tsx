import { useState } from 'react';
import { Users, UserPlus, Edit2, Trash2, AlertCircle, Home, X, Phone } from 'lucide-react';

export interface Colocataire {
  id: string;
  nom: string;
  prenom: string;
  dateEntree: string; // YYYY-MM-DD
  dateSortie: string | null; // YYYY-MM-DD ou null si toujours présent
  telephone?: string;
  loyer?: number;
  avanceCharge?: number;
}

interface ColocatairesProps {
  colocataires: Colocataire[];
  onSaveColoc: (coloc: Omit<Colocataire, 'id'>, id: string | null) => void;
  onDeleteColoc: (id: string, name: string) => void;
  onNavigate: (tab: 'home' | 'colocs' | 'calculator' | 'history') => void;
}

export default function Colocataires({
  colocataires,
  onSaveColoc,
  onDeleteColoc,
  onNavigate
}: ColocatairesProps) {
  // --- États Formulaire Colocataire ---
  const [editingColocId, setEditingColocId] = useState<string | null>(null);
  const [formPrenom, setFormPrenom] = useState('');
  const [formNom, setFormNom] = useState('');
  const [formDateEntree, setFormDateEntree] = useState('');
  const [formDateSortie, setFormDateSortie] = useState('');
  const [formTelephone, setFormTelephone] = useState('');
  const [formLoyer, setFormLoyer] = useState('');
  const [colocFormError, setColocFormError] = useState('');

  // Récupérer le montant de l'avance mensuelle définie dans le localStorage (définie dans le Calculateur)
  const getDefinedAdvance = () => {
    const saved = localStorage.getItem('coloc_avances_mensuelles');
    if (saved) {
      try {
        const map = JSON.parse(saved);
        const currentYear = new Date().getFullYear();
        if (map[currentYear] !== undefined) {
          return map[currentYear];
        }
        const keys = Object.keys(map).map(Number);
        if (keys.length > 0) {
          return map[keys[0]];
        }
      } catch (e) {
        // fallback
      }
    }
    return 150;
  };

  const avanceChargeDefinie = getDefinedAdvance();

  // --- États Modals ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [pendingColocData, setPendingColocData] = useState<{
    prenom: string;
    nom: string;
    dateEntree: string;
    dateSortie: string | null;
    telephone: string;
    loyer: number;
    avanceCharge: number;
  } | null>(null);

  const formatTelephone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const trimmed = digits.substring(0, 10);
    const parts = [];
    for (let i = 0; i < trimmed.length; i += 2) {
      parts.push(trimmed.substring(i, i + 2));
    }
    return parts.join(' ');
  };

  const handleTelephoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormTelephone(formatTelephone(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setColocFormError('');

    if (!formPrenom.trim() || !formNom.trim() || !formDateEntree) {
      setColocFormError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formDateSortie && formDateSortie < formDateEntree) {
      setColocFormError("La date de sortie ne peut pas être antérieure à la date d'entrée.");
      return;
    }

    const colocData = {
      prenom: formPrenom.trim(),
      nom: formNom.trim(),
      dateEntree: formDateEntree,
      dateSortie: formDateSortie || null,
      telephone: formTelephone.trim(),
      loyer: parseFloat(formLoyer) || 0,
      avanceCharge: avanceChargeDefinie
    };

    if (editingColocId) {
      onSaveColoc(colocData, editingColocId);
      resetForm();
    } else {
      setPendingColocData(colocData);
      setShowConfirmModal(true);
    }
  };

  const startEdit = (coloc: Colocataire) => {
    setEditingColocId(coloc.id);
    setFormPrenom(coloc.prenom);
    setFormNom(coloc.nom);
    setFormDateEntree(coloc.dateEntree);
    setFormDateSortie(coloc.dateSortie || '');
    setFormTelephone(coloc.telephone || '');
    setFormLoyer(coloc.loyer !== undefined ? String(coloc.loyer) : '');
    setColocFormError('');
  };

  const handleStartEditFromModal = (coloc: Colocataire) => {
    startEdit(coloc);
    setShowListModal(false);
  };

  const resetForm = () => {
    setEditingColocId(null);
    setFormPrenom('');
    setFormNom('');
    setFormDateEntree('');
    setFormDateSortie('');
    setFormTelephone('');
    setFormLoyer('');
    setColocFormError('');
  };

  const handleConfirmAdd = () => {
    if (pendingColocData) {
      onSaveColoc(pendingColocData, null);
      resetForm();
    }
    setShowConfirmModal(false);
    setPendingColocData(null);
  };

  const handleCancelAdd = () => {
    setShowConfirmModal(false);
    setPendingColocData(null);
  };

  const getColocStatus = (coloc: Colocataire) => {
    const today = new Date().toISOString().split('T')[0];
    if (today < coloc.dateEntree) {
      return { label: 'Futur', class: 'badge-future' };
    }
    if (coloc.dateSortie && today > coloc.dateSortie) {
      return { label: 'Parti', class: 'badge-inactive' };
    }
    return { label: 'Actif', class: 'badge-active' };
  };

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
        <Home size={16} />
        <span>← Retour à l'accueil</span>
      </button>

      <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} />
          <span>Saisie des colocataires</span>
        </div>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={() => setShowListModal(true)}
          style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center', border: '1px solid var(--border-color)' }}
        >
          <Users size={16} />
          <span>Colocataires</span>
        </button>
      </div>

      {/* Formulaire d'ajout / modification */}
      <div className="card" style={{ borderLeft: '4px solid var(--secondary)', marginBottom: '20px' }}>
        <div className="card-title">
          <UserPlus size={16} style={{ color: 'var(--secondary)' }} />
          <span>{editingColocId ? 'Modifier les détails' : 'Enregistrer un nouveau colocataire'}</span>
        </div>
        <p className="card-subtitle">
          Indiquez les dates exactes d'entrée et de sortie pour répartir les frais de chaque mois au jour près.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prénom *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formPrenom}
                onChange={(e) => setFormPrenom(e.target.value)}
                placeholder="Ex: Jean"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nom *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex: Dupont"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date d'entrée *</label>
              <input 
                type="date" 
                className="input-field" 
                value={formDateEntree}
                onChange={(e) => setFormDateEntree(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date de sortie</label>
              <input 
                type="date" 
                className="input-field" 
                value={formDateSortie}
                onChange={(e) => setFormDateSortie(e.target.value)}
                placeholder="Laisser vide si toujours présent"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Montant du loyer (€) *</label>
              <input 
                type="number" 
                step="any"
                className="input-field" 
                value={formLoyer}
                onChange={(e) => setFormLoyer(e.target.value)}
                placeholder="Ex: 500"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Avance de charges (€)</label>
              <input 
                type="text" 
                className="input-field" 
                value={`${avanceChargeDefinie.toFixed(2)} €`}
                disabled
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  cursor: 'not-allowed',
                  opacity: 0.8
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Téléphone</label>
            <input 
              type="text" 
              className="input-field" 
              value={formTelephone}
              onChange={handleTelephoneChange}
              placeholder="00 00 00 00 00"
            />
          </div>

          {colocFormError && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <AlertCircle size={14} />
              <span>{colocFormError}</span>
            </div>
          )}

          <div className="form-row" style={{ marginTop: '8px' }}>
            {editingColocId ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, var(--secondary), #0f766e)' }}>
                  Sauvegarder
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, var(--secondary), #0f766e)', gridColumn: 'span 2' }}>
                Ajouter
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Modal de consultation des colocataires */}
      {showListModal && (
        <div className="modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Users size={18} />
                <span>Colocataires enregistrés ({colocataires.length})</span>
              </div>
              <button className="icon-btn" onClick={() => setShowListModal(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="coloc-list">
                {colocataires.length === 0 ? (
                  <div className="empty-state" style={{ padding: '16px 0' }}>
                    <Users size={32} className="empty-icon" />
                    <p className="empty-text">Aucun colocataire enregistré.</p>
                  </div>
                ) : (
                  colocataires.map((coloc) => {
                    const status = getColocStatus(coloc);
                    const initials = `${coloc.prenom.charAt(0)}${coloc.nom.charAt(0)}`.toUpperCase();
                    
                    return (
                      <div key={coloc.id} className="coloc-item">
                        <div className="coloc-left">
                          <div className="avatar">{initials}</div>
                          <div className="coloc-info">
                            <span className="coloc-name">{coloc.prenom} {coloc.nom}</span>
                            <span className="coloc-dates">
                              Entrée : {new Date(coloc.dateEntree).toLocaleDateString('fr-FR')} 
                              {coloc.dateSortie ? ` | Sortie : ${new Date(coloc.dateSortie).toLocaleDateString('fr-FR')}` : ' (Toujours présent)'}
                            </span>
                            <span className="coloc-dates" style={{ marginTop: '2px' }}>
                              Loyer : {coloc.loyer !== undefined ? `${coloc.loyer.toFixed(2)} €` : '0.00 €'} | Avance : {coloc.avanceCharge !== undefined ? `${coloc.avanceCharge.toFixed(2)} €` : '0.00 €'}
                            </span>
                            {coloc.telephone && (
                              <span className="coloc-dates" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <Phone size={12} style={{ color: 'var(--text-secondary)' }} />
                                {coloc.telephone}
                              </span>
                            )}
                            <span className={`status-badge ${status.class}`}>{status.label}</span>
                          </div>
                        </div>
                        
                        <div className="coloc-actions">
                          <button 
                            className="icon-btn" 
                            onClick={() => handleStartEditFromModal(coloc)}
                            aria-label="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            className="icon-btn icon-btn-danger" 
                            onClick={() => onDeleteColoc(coloc.id, `${coloc.prenom} ${coloc.nom}`)}
                            aria-label="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowListModal(false)} style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation d'ajout */}
      {showConfirmModal && pendingColocData && (
        <div className="modal-overlay" onClick={handleCancelAdd}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <AlertCircle size={18} style={{ color: 'var(--primary)' }} />
                <span>Confirmer l'ajout</span>
              </div>
              <button className="icon-btn" onClick={handleCancelAdd} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Voulez-vous enregistrer ce colocataire ?
              </p>

              <div className="modal-confirm-info">
                <div className="modal-confirm-row">
                  <span className="modal-confirm-label">Prénom :</span>
                  <span className="modal-confirm-value">{pendingColocData.prenom}</span>
                </div>
                <div className="modal-confirm-row">
                  <span className="modal-confirm-label">Nom :</span>
                  <span className="modal-confirm-value">{pendingColocData.nom}</span>
                </div>
                <div className="modal-confirm-row">
                  <span className="modal-confirm-label">Date d'entrée :</span>
                  <span className="modal-confirm-value">
                    {new Date(pendingColocData.dateEntree).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {pendingColocData.dateSortie && (
                  <div className="modal-confirm-row">
                    <span className="modal-confirm-label">Date de sortie :</span>
                    <span className="modal-confirm-value">
                      {new Date(pendingColocData.dateSortie).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                {pendingColocData.telephone && (
                  <div className="modal-confirm-row">
                    <span className="modal-confirm-label">Téléphone :</span>
                    <span className="modal-confirm-value">{pendingColocData.telephone}</span>
                  </div>
                )}
                <div className="modal-confirm-row">
                  <span className="modal-confirm-label">Loyer :</span>
                  <span className="modal-confirm-value">{pendingColocData.loyer.toFixed(2)} €</span>
                </div>
                <div className="modal-confirm-row">
                  <span className="modal-confirm-label">Avance charges :</span>
                  <span className="modal-confirm-value">{pendingColocData.avanceCharge.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCancelAdd} style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmAdd} 
                style={{ width: 'auto', padding: '10px 20px', fontSize: '14px', background: 'linear-gradient(135deg, var(--secondary), #0f766e)' }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

