import { useState } from 'react';
import { Users, UserPlus, Edit2, Trash2, AlertCircle, Home } from 'lucide-react';

export interface Colocataire {
  id: string;
  nom: string;
  prenom: string;
  dateEntree: string; // YYYY-MM-DD
  dateSortie: string | null; // YYYY-MM-DD ou null si toujours présent
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
  const [colocFormError, setColocFormError] = useState('');

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

    onSaveColoc({
      prenom: formPrenom.trim(),
      nom: formNom.trim(),
      dateEntree: formDateEntree,
      dateSortie: formDateSortie || null
    }, editingColocId);

    resetForm();
  };

  const startEdit = (coloc: Colocataire) => {
    setEditingColocId(coloc.id);
    setFormPrenom(coloc.prenom);
    setFormNom(coloc.nom);
    setFormDateEntree(coloc.dateEntree);
    setFormDateSortie(coloc.dateSortie || '');
    setColocFormError('');
  };

  const resetForm = () => {
    setEditingColocId(null);
    setFormPrenom('');
    setFormNom('');
    setFormDateEntree('');
    setFormDateSortie('');
    setColocFormError('');
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

      <div className="tab-header">
        <Users size={20} />
        <span>Saisie des colocataires</span>
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

          {colocFormError && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <AlertCircle size={14} />
              <span>{colocFormError}</span>
            </div>
          )}

          <div className="form-row" style={{ marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Vider
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, var(--secondary), #0f766e)' }}>
              {editingColocId ? 'Sauvegarder' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>

      {/* Liste des colocataires */}
      <div className="card">
        <div className="card-title">
          <Users size={16} />
          <span>Colocataires enregistrés ({colocataires.length})</span>
        </div>

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
                      <span className={`status-badge ${status.class}`}>{status.label}</span>
                    </div>
                  </div>
                  
                  <div className="coloc-actions">
                    <button 
                      className="icon-btn" 
                      onClick={() => startEdit(coloc)}
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
    </div>
  );
}
