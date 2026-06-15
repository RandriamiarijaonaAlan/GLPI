import { useEffect, useMemo, useState } from "react";
import clientGlpiLegacy from "../../api/glpiLegacyClient";
import { recupererCoutsKanbanSqlite } from "../../api/kanbanCostsApi";
import { recupererDetailTicketKanban } from "../../api/kanbanApi";

function normaliserListe(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

function convertirNombre(valeur) {
  const nombre = Number(String(valeur ?? "0").replace(/\s+/g, "").replace(",", "."));
  return Number.isNaN(nombre) ? 0 : nombre;
}

function lireIdTicket(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "-";
  if (typeof valeur === "object") return valeur.id || valeur.value || "-";
  return valeur;
}

function calculerCoutAncien(cout) {
  const fixe = convertirNombre(cout.cost_fixed);
  const tauxTemps = convertirNombre(cout.cost_time);
  const dureeSecondes = convertirNombre(cout.actiontime);
  return fixe + (dureeSecondes / 3600) * tauxTemps;
}

function construireTotauxGlpiParTicket(anciensCouts) {
  const totaux = new Map();

  anciensCouts.forEach((cout) => {
    const ticketId = String(lireIdTicket(cout.tickets_id));
    if (!ticketId || ticketId === "-") return;
    totaux.set(ticketId, (totaux.get(ticketId) || 0) + calculerCoutAncien(cout));
  });

  return totaux;
}

function extrairePourcentageReouverture(commentaire) {
  const texte = String(commentaire || "");
  const correspondance = texte.match(/Reouverture\s*\+([0-9]+(?:[.,][0-9]+)?)%/i);
  return correspondance ? convertirNombre(correspondance[1]) : null;
}

function calculerVentilationCoutKanban(cout, totauxGlpiParTicket) {
  const total = convertirNombre(cout.cout_fixe);
  const commentaire = String(cout.commentaire || "");
  const commentaireMin = commentaire.toLowerCase();

  if (commentaireMin.includes("import reouverture")) {
    return { supercost: 0, reouverture: total };
  }

  // Ancien format cree avant correction : cout_fixe contenait le pourcentage open.
  if (commentaireMin.trim() === "import open") {
    const totalGlpi = totauxGlpiParTicket.get(String(cout.ticket_id)) || 0;
    return { supercost: 0, reouverture: (totalGlpi * total) / 100 };
  }

  const pourcentage = extrairePourcentageReouverture(commentaire);
  if (pourcentage !== null) {
    const supercost = total / (1 + pourcentage / 100);
    return { supercost, reouverture: total - supercost };
  }

  return { supercost: total, reouverture: 0 };
}

function lireItemsCout(cout) {
  try {
    const items = JSON.parse(cout.items_json || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

const libellesItemtype = {
  Computer: "PC",
  Monitor: "Moniteur",
  Printer: "Imprimante",
  Phone: "Telephone",
  NetworkEquipment: "Equipement reseau",
  Peripheral: "Peripherique",
  Software: "Logiciel",
  SoftwareLicense: "Licence logiciel",
};

function afficherTypeItem(item) {
  return libellesItemtype[item.itemtype] || item.itemtype || "Materiel";
}

function formaterMontant(valeur) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(convertirNombre(valeur));
}

function afficherNomsItems(cout) {
  const items = lireItemsCout(cout);

  if (items.length === 0) {
    return "-";
  }

  return items.map((item) => `${afficherTypeItem(item)} : ${item.nom || "-"}`).join(", ");
}

async function enrichirCoutKanban(cout) {
  if (lireItemsCout(cout).length > 0) {
    return cout;
  }

  try {
    const detail = await recupererDetailTicketKanban(cout.ticket_id);
    const items = (detail.elementsLies || []).map((item) => ({
      nom: item.nom || "-",
      itemtype: item.itemtype || "-",
      id: item.items_id || item.id || "",
    }));

    return {
      ...cout,
      items_json: JSON.stringify(items),
      nombre_items: Math.max(1, items.length || convertirNombre(cout.nombre_items)),
    };
  } catch {
    return cout;
  }
}

async function enrichirCoutImport(cout) {
  if (lireItemsCout(cout).length > 0) {
    return cout;
  }

  try {
    const detail = await recupererDetailTicketKanban(lireIdTicket(cout.tickets_id));
    const items = (detail.elementsLies || []).map((item) => ({
      nom: item.nom || "-",
      itemtype: item.itemtype || "-",
      id: item.items_id || item.id || "",
    }));

    return {
      ...cout,
      items_json: JSON.stringify(items),
    };
  } catch {
    return cout;
  }
}

async function recupererAnciensCoutsImportes() {
  const reponse = await clientGlpiLegacy.get("/TicketCost?range=0-9999");
  return normaliserListe(reponse.data).filter((cout) =>
    String(cout.name || "").includes("NEWAPP_IMPORT_JUIN_2026"),
  );
}

export default function CoutsTickets() {
  const [anciensCouts, setAnciensCouts] = useState([]);
  const [nouveauxCouts, setNouveauxCouts] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurs, setErreurs] = useState([]);
  const [typeSelectionne, setTypeSelectionne] = useState(null);

  async function chargerCouts() {
    setChargement(true);
    setErreurs([]);

    const [anciens, nouveaux] = await Promise.allSettled([
      recupererAnciensCoutsImportes(),
      recupererCoutsKanbanSqlite(),
    ]);

    if (anciens.status === "fulfilled") {
      setAnciensCouts(await Promise.all(anciens.value.map(enrichirCoutImport)));
    } else {
      setAnciensCouts([]);
    }

    if (nouveaux.status === "fulfilled") {
      setNouveauxCouts(await Promise.all(nouveaux.value.map(enrichirCoutKanban)));
    } else {
      setNouveauxCouts([]);
    }

    const messages = [];
    if (anciens.status === "rejected") {
      messages.push("Anciens couts importes indisponibles.");
    }
    if (nouveaux.status === "rejected") {
      messages.push("Nouveaux couts Kanban indisponibles. Verifiez que le backend SQLite tourne sur le port 3001.");
    }

    setErreurs(messages);
    setChargement(false);
  }

  useEffect(() => {
    chargerCouts();
  }, []);

  const totaux = useMemo(() => {
    const totauxGlpiParTicket = construireTotauxGlpiParTicket(anciensCouts);
    const totalGlpi = anciensCouts.reduce((total, cout) => total + calculerCoutAncien(cout), 0);
    const totalNouveau = nouveauxCouts.reduce((acc, cout) => {
      const ventilation = calculerVentilationCoutKanban(cout, totauxGlpiParTicket);
      acc.reouverture += ventilation.reouverture;
      acc.supercost += ventilation.supercost;
      return acc;
    }, { reouverture: 0, supercost: 0 });

    return {
      totalGlpi,
      totalReouverture: totalNouveau.reouverture,
      totalSupercost: totalNouveau.supercost,
      totalGeneral: totalGlpi + totalNouveau.reouverture + totalNouveau.supercost,
    };
  }, [anciensCouts, nouveauxCouts]);

  const coutsParMateriel = useMemo(() => {
    const lignes = new Map();
    const totauxGlpiParTicket = construireTotauxGlpiParTicket(anciensCouts);

    function garantirLigne(type) {
      if (!lignes.has(type)) {
        lignes.set(type, { type, glpi: 0, reouverture: 0, supercost: 0, items: new Map() });
      }
      return lignes.get(type);
    }

    function ajouterItemALigne(ligne, nom, glpi, reouverture, supercost) {
      if (!ligne.items.has(nom)) {
        ligne.items.set(nom, { nom, glpi: 0, reouverture: 0, supercost: 0 });
      }
      const item = ligne.items.get(nom);
      item.glpi += glpi;
      item.reouverture += reouverture;
      item.supercost += supercost;
    }

    anciensCouts.forEach((cout) => {
      const items = lireItemsCout(cout);
      const total = calculerCoutAncien(cout);

      if (items.length === 0) {
        const ligne = garantirLigne("Materiel");
        ligne.glpi += total;
        ajouterItemALigne(ligne, "Inconnu", total, 0, 0);
        return;
      }

      const coutParAsset = total / items.length;
      items.forEach((item) => {
        const ligne = garantirLigne(afficherTypeItem(item));
        ligne.glpi += coutParAsset;
        ajouterItemALigne(ligne, item.nom || "Inconnu", coutParAsset, 0, 0);
      });
    });

    nouveauxCouts.forEach((cout) => {
      const items = lireItemsCout(cout);
      const ventilation = calculerVentilationCoutKanban(cout, totauxGlpiParTicket);
      const totalVentile = ventilation.reouverture + ventilation.supercost;

      if (totalVentile === 0) {
        return;
      }

      if (items.length === 0) {
        const ligne = garantirLigne("Materiel");
        ligne.reouverture += ventilation.reouverture;
        ligne.supercost += ventilation.supercost;
        ajouterItemALigne(ligne, "Inconnu", 0, ventilation.reouverture, ventilation.supercost);
        return;
      }

      const reouvertureParAsset = ventilation.reouverture / items.length;
      const supercostParAsset = ventilation.supercost / items.length;
      items.forEach((item) => {
        const ligne = garantirLigne(afficherTypeItem(item));
        ligne.reouverture += reouvertureParAsset;
        ligne.supercost += supercostParAsset;
        ajouterItemALigne(ligne, item.nom || "Inconnu", 0, reouvertureParAsset, supercostParAsset);
      });
    });

    return Array.from(lignes.values())
      .map((ligne) => ({
        ...ligne,
        items: Array.from(ligne.items.values()).sort(
          (a, b) => (b.glpi + b.reouverture + b.supercost) - (a.glpi + a.reouverture + a.supercost)
        ),
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [anciensCouts, nouveauxCouts]);

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Couts tickets</h1>
          <p>Anciens couts importes et nouveaux couts saisis depuis le Kanban.</p>
        </div>
        <button type="button" onClick={chargerCouts} disabled={chargement}>
          {chargement ? "Chargement..." : "Actualiser"}
        </button>
      </div>

      {erreurs.map((message) => (
        <p className="message-erreur" key={message}>
          {message}
        </p>
      ))}
      {chargement ? <p>Chargement des couts...</p> : null}

      {!chargement ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>GLPI</span>
              <strong>{totaux.totalGlpi.toFixed(2)}</strong>
            </article>
            <article className="stat-card">
              <span>Reouverture</span>
              <strong>{totaux.totalReouverture.toFixed(2)}</strong>
            </article>
            <article className="stat-card">
              <span>Supercost</span>
              <strong>{totaux.totalSupercost.toFixed(2)}</strong>
            </article>
            <article className="stat-card">
              <span>Cout total</span>
              <strong>{totaux.totalGeneral.toFixed(2)}</strong>
            </article>
          </section>

          <section style={stylesCoutsMateriel.section}>
            <div style={stylesCoutsMateriel.entete}>
              <h2 style={stylesCoutsMateriel.titre}>Couts par materiel</h2>
            </div>
            <div style={stylesCoutsMateriel.tableWrap}>
              <table style={stylesCoutsMateriel.table}>
                <thead>
                  <tr>
                    <th style={stylesCoutsMateriel.th}>Materiel</th>
                    <th style={stylesCoutsMateriel.th}>GLPI</th>
                    <th style={stylesCoutsMateriel.th}>Reouverture</th>
                    <th style={stylesCoutsMateriel.th}>Supercost</th>
                    <th style={stylesCoutsMateriel.th}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {coutsParMateriel.flatMap((ligne) => {
                    const ouvert = typeSelectionne === ligne.type;
                    const rangees = [
                      <tr key={ligne.type}>
                        <td
                          style={{ ...stylesCoutsMateriel.tdType, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setTypeSelectionne(ouvert ? null : ligne.type)}
                          title="Cliquer pour voir le détail"
                        >
                          {ligne.type} {ouvert ? '▲' : '▼'}
                        </td>
                        <td style={stylesCoutsMateriel.td}>{formaterMontant(ligne.glpi)}</td>
                        <td style={stylesCoutsMateriel.td}>{formaterMontant(ligne.reouverture)}</td>
                        <td style={stylesCoutsMateriel.td}>{formaterMontant(ligne.supercost)}</td>
                        <td style={stylesCoutsMateriel.td}>{formaterMontant(ligne.glpi + ligne.reouverture + ligne.supercost)}</td>
                      </tr>,
                    ];
                    if (ouvert) {
                      rangees.push(
                        <tr key={`${ligne.type}-detail`}>
                          <td colSpan={5} style={{ padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.04)' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...stylesCoutsMateriel.th, paddingLeft: '32px', fontSize: '11px' }}>Item</th>
                                  <th style={{ ...stylesCoutsMateriel.th, fontSize: '11px' }}>GLPI</th>
                                  <th style={{ ...stylesCoutsMateriel.th, fontSize: '11px' }}>Reouverture</th>
                                  <th style={{ ...stylesCoutsMateriel.th, fontSize: '11px' }}>Supercost</th>
                                  <th style={{ ...stylesCoutsMateriel.th, fontSize: '11px' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ligne.items.map((item) => (
                                  <tr key={item.nom}>
                                    <td style={{ ...stylesCoutsMateriel.td, paddingLeft: '32px', color: '#a5b4fc', fontSize: '13px' }}>{item.nom}</td>
                                    <td style={{ ...stylesCoutsMateriel.td, fontSize: '13px' }}>{formaterMontant(item.glpi)}</td>
                                    <td style={{ ...stylesCoutsMateriel.td, fontSize: '13px' }}>{formaterMontant(item.reouverture)}</td>
                                    <td style={{ ...stylesCoutsMateriel.td, fontSize: '13px' }}>{formaterMontant(item.supercost)}</td>
                                    <td style={{ ...stylesCoutsMateriel.td, fontSize: '13px' }}>{formaterMontant(item.glpi + item.reouverture + item.supercost)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      );
                    }
                    return rangees;
                  })}
                  <tr>
                    <td style={stylesCoutsMateriel.totalLabel}>Total</td>
                    <td style={stylesCoutsMateriel.totalCell}>{formaterMontant(totaux.totalGlpi)}</td>
                    <td style={stylesCoutsMateriel.totalCell}>{formaterMontant(totaux.totalReouverture)}</td>
                    <td style={stylesCoutsMateriel.totalCell}>{formaterMontant(totaux.totalSupercost)}</td>
                    <td style={stylesCoutsMateriel.totalCell}>{formaterMontant(totaux.totalGeneral)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="detail-panel">
            <h2>Nouveaux couts Kanban</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Cout fixe</th>
                    <th>Nombre items</th>
                    <th>Assets lies</th>
                    <th>Cout ticket par assets</th>
                    <th>Commentaire</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {nouveauxCouts.map((cout) => (
                    <tr key={cout.id}>
                      <td>#{cout.ticket_id}</td>
                      <td>{convertirNombre(cout.cout_fixe).toFixed(2)}</td>
                      <td>{cout.nombre_items}</td>
                      <td>{afficherNomsItems(cout)}</td>
                      <td>{convertirNombre(cout.cout_par_item).toFixed(2)}</td>
                      <td>{cout.commentaire || "-"}</td>
                      <td>{cout.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="detail-panel">
            <h2>Anciens couts importes</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ticket</th>
                    <th>Duree secondes</th>
                    <th>Taux temps</th>
                    <th>Cout fixe</th>
                    <th>Total calcule</th>
                  </tr>
                </thead>
                <tbody>
                  {anciensCouts.map((cout) => (
                    <tr key={cout.id}>
                      <td>{cout.id}</td>
                      <td>{lireIdTicket(cout.tickets_id)}</td>
                      <td>{convertirNombre(cout.actiontime).toFixed(2)}</td>
                      <td>{convertirNombre(cout.cost_time).toFixed(2)}</td>
                      <td>{convertirNombre(cout.cost_fixed).toFixed(2)}</td>
                      <td>{calculerCoutAncien(cout).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

const stylesCoutsMateriel = {
  section: {
    marginBottom: "20px",
    padding: "22px",
    borderRadius: "8px",
    background: "#171b26",
    color: "#eef3ff",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  entete: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  titre: {
    margin: 0,
    fontSize: "22px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.22)",
    color: "#dbe6ff",
    fontSize: "12px",
    textTransform: "uppercase",
    textAlign: "left",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    color: "#eef3ff",
  },
  tdType: {
    padding: "14px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    color: "#dbe6ff",
    fontWeight: 700,
  },
  totalLabel: {
    padding: "14px",
    color: "#eef3ff",
    fontWeight: 800,
  },
  totalCell: {
    padding: "14px",
    color: "#eef3ff",
    fontWeight: 800,
  },
};
