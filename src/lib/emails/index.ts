// ─── Client Resend ──────────────────────────────────────────────────────────
// Variable d'environnement requise : RESEND_API_KEY=re_...
// À obtenir sur : https://resend.com (plan gratuit = 3 000 emails/mois)
// Domaine expéditeur : configurez noreply@klasbook.be dans le dashboard Resend

import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY manquante dans .env.local");
  return new Resend(key);
}

const FROM = "Klasbook <noreply@klasbook.be>";

// ─── Types ──────────────────────────────────────────────────────────────────

type SendResult = { success: boolean; error?: string };

// ─── Templates HTML ─────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Klasbook</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <!-- Logo -->
        <tr><td style="padding-bottom:24px;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);display:inline-block;text-align:center;line-height:36px;font-size:18px;color:#fff">✦</div>
            <span style="font-weight:900;font-size:18px;color:#0f172a">Klasbook</span>
          </div>
        </td></tr>
        <!-- Content -->
        <tr><td style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px;text-align:center;font-size:11px;color:#94a3b8">
          Klasbook · La gestion de classe simplifiée pour la FWB<br>
          <a href="https://klasbook.be/vie-privee" style="color:#94a3b8">Politique de confidentialité</a> ·
          <a href="https://klasbook.be/cgu" style="color:#94a3b8">CGU</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email de bienvenue ──────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  to: string;
  firstName: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName } = params;

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:24px;font-weight:900;color:#fff">Bienvenue sur Klasbook ! 🎉</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">Ta plateforme pédagogique FWB</div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton compte Klasbook est prêt. Tu peux dès maintenant générer des exercices IA conformes
          aux référentiels officiels FWB, créer des évaluations avec ton canevas école,
          et utiliser l'Inspecteur FWB comme assistant pédagogique.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Avec le plan gratuit, tu as accès à <strong>10 générations d'exercices par mois</strong>.
          Passe au plan Pro pour un accès illimité.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://klasbook.be/dashboard"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Accéder à mon tableau de bord →
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Une question ? Réponds directement à cet email ou écris à
          <a href="mailto:support@klasbook.be" style="color:#0A84FF">support@klasbook.be</a>
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: "Bienvenue sur Klasbook 🎉",
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email d'invitation parent ────────────────────────────────────────────

export async function sendParentInvitationEmail(params: {
  to: string;
  parentName?: string;
  studentName: string;
  teacherName: string;
  schoolName: string;
  invitationLink: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, parentName, studentName, teacherName, schoolName, invitationLink } = params;

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Invitation au portail parents 👨‍👩‍👧</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">${schoolName}</div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">
          ${parentName ? `Bonjour ${parentName},` : "Bonjour,"}
        </p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          <strong>${teacherName}</strong> vous invite à suivre les résultats et l'évolution
          scolaire de <strong>${studentName}</strong> via le portail parents Klasbook.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Vous pourrez consulter les résultats des évaluations, le bulletin de compétences
          et les communications de l'équipe enseignante.
        </p>
        <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-size:12px;color:#64748b;margin-bottom:4px">Élève concerné(e)</div>
          <div style="font-weight:800;color:#0f172a;font-size:15px">${studentName}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${schoolName}</div>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${invitationLink}"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Accéder au portail parents →
          </a>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin:0">
          Ce lien est valable 7 jours. Si vous n'attendiez pas cet email, ignorez-le.
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Invitation au portail parents — ${studentName} — ${schoolName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email de confirmation d'abonnement ──────────────────────────────────

export async function sendSubscriptionConfirmationEmail(params: {
  to: string;
  firstName: string;
  plan: "pro" | "ecole";
  billing: "monthly" | "annual";
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName, plan, billing } = params;

    const planLabel = plan === "pro" ? "Pro Professeur" : "École";
    const billingLabel = billing === "monthly" ? "mensuel" : "annuel";

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Abonnement activé ✅</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">
          Plan ${planLabel} · ${billingLabel}
        </div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton abonnement <strong>Klasbook ${planLabel}</strong> est actif.
          Tu as désormais accès à toutes les fonctionnalités sans limitation.
        </p>
        <div style="background:#f0fdf4;border-radius:10px;border:1px solid #86efac;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-weight:800;color:#16a34a;font-size:14px;margin-bottom:8px">
            ✓ Ce qui est inclus dans ton plan
          </div>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.8">
            <li>Génération d'exercices IA illimitée</li>
            <li>7 matières — référentiels IFPC/FWB intégrés</li>
            <li>Page élève + correction IA des copies</li>
            <li>Bulletins et compétences FWB</li>
            <li>Portail parents intégré</li>
            ${plan === "ecole" ? "<li>Portail direction + jusqu'à 20 professeurs</li>" : ""}
          </ul>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="https://klasbook.be/dashboard"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Aller sur mon tableau de bord →
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Gérer mon abonnement :
          <a href="https://klasbook.be/profil" style="color:#0A84FF">Mon profil Klasbook</a>
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Bienvenue sur Klasbook ${planLabel} 🚀`,
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email d'initiation essai 14 jours ──────────────────────────────────

export async function sendTrialInitiationEmail(params: {
  to: string;
  firstName: string;
  plan: "pro" | "ecole";
  trialEndsAt: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName, plan, trialEndsAt } = params;

    const planLabel = plan === "pro" ? "Pro Professeur" : "École";

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Essai gratuit activé 🎁</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">
          Plan ${planLabel} · 14 jours gratuits
        </div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton essai gratuit <strong>Klasbook ${planLabel}</strong> est activé.
          Tu as accès à toutes les fonctionnalités premium sans aucun frais jusqu'à la fin de la période d'essai.
        </p>
        <div style="background:#fef3c7;border-radius:10px;border:1px solid #fcd34d;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-weight:800;color:#92400e;font-size:14px;margin-bottom:8px">
            ⏰ Essai jusqu'au ${trialEndsAt}
          </div>
          <p style="font-size:13px;color:#78350f;margin:0;line-height:1.6">
            À la fin de la période d'essai, ton abonnement sera activé automatiquement.
            Aucune charge avant cette date. Tu peux annuler à tout moment.
          </p>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Profite de cette période pour explorer toutes les fonctionnalités :
          génération d'exercices IA, bulletins FWB, évaluations, portail parents, et bien plus.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://klasbook.be/dashboard"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Accéder à mon tableau de bord →
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          Une question ? Réponds directement à cet email ou écris à
          <a href="mailto:support@klasbook.be" style="color:#0A84FF">support@klasbook.be</a>
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Essai gratuit Klasbook ${planLabel} activé 🎁`,
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email d'avertissement expiration essai (GDPR Art. 21) ───────────────

export async function sendTrialExpirationWarningEmail(params: {
  to: string;
  firstName: string;
  plan: "pro" | "ecole";
  chargeDate: string;
  amount: number;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName, plan, chargeDate, amount } = params;

    const planLabel = plan === "pro" ? "Pro Professeur" : "École";

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Essai se termine bientôt ⏰</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">
          Ton abonnement sera activé dans 48 heures
        </div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton essai gratuit Klasbook ${planLabel} se termine dans les <strong>48 prochaines heures</strong>.
          Ton abonnement payant sera automatiquement activé sauf si tu l'annules.
        </p>
        <div style="background:#fee2e2;border-radius:10px;border:1px solid #fecaca;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-weight:800;color:#991b1b;font-size:14px;margin-bottom:8px">
            💳 Charge prévue le ${chargeDate}
          </div>
          <p style="font-size:13px;color:#7f1d1d;margin:0;line-height:1.6">
            Montant : <strong>€${amount.toFixed(2)}</strong>
          </p>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Tu as le droit d'annuler cet abonnement à tout moment jusqu'à la date de facturation.
          Aucune charge supplémentaire ne sera appliquée après l'annulation.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://klasbook.be/profil"
             style="display:inline-block;padding:13px 32px;border-radius:12px;
                    background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);
                    color:#fff;font-weight:800;font-size:14px;text-decoration:none">
            Gérer mon abonnement →
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:11px;color:#94a3b8;margin:0">
          <strong>GDPR Art. 21 — Droit de rétractation :</strong>
          Tu peux annuler cet abonnement à tout moment. Aucune charge supplémentaire ne sera appliquée après l'annulation.
          <br><a href="mailto:support@klasbook.be" style="color:#0A84FF">Contacte le support</a> pour plus d'aide.
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: `⚠️ Ton essai Klasbook se termine dans 48 heures`,
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Email de confirmation d'annulation ──────────────────────────────────

export async function sendCancellationConfirmationEmail(params: {
  to: string;
  firstName: string;
  plan: "pro" | "ecole";
  accessUntil: string;
  surveyUrl?: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { to, firstName, plan, accessUntil, surveyUrl } = params;

    const planLabel = plan === "pro" ? "Pro Professeur" : "École";

    const html = baseLayout(`
      <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:28px 32px">
        <div style="font-size:20px;font-weight:900;color:#fff">Abonnement annulé ✓</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">
          Tu as accès jusqu'au ${accessUntil}
        </div>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Bonjour ${firstName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
          Ton abonnement Klasbook ${planLabel} a été annulé. Tu conserves l'accès à toutes les fonctionnalités
          jusqu'au <strong>${accessUntil}</strong>, puis tu repasseras au plan gratuit.
        </p>
        <div style="background:#dcfce7;border-radius:10px;border:1px solid #86efac;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-weight:800;color:#166534;font-size:14px;margin-bottom:8px">
            ✓ Confirmation de l'annulation
          </div>
          <p style="font-size:13px;color:#166534;margin:0;line-height:1.6">
            Ton abonnement ne sera pas renouvelé. Aucune charge supplémentaire ne sera appliquée.
          </p>
        </div>
        <div style="background:#fef3c7;border-radius:10px;border:1px solid #fcd34d;
                    padding:16px 20px;margin:0 0 24px">
          <div style="font-weight:800;color:#92400e;font-size:14px;margin-bottom:8px">
            🎁 Nous aimerions te garder !
          </div>
          <p style="font-size:13px;color:#78350f;margin:0 0 12px;line-height:1.6">
            Utilise le code <strong>REVENEZ20</strong> pour obtenir <strong>-20% de réduction</strong>
            si tu décides de réabonner dans les 30 prochains jours.
          </p>
          <a href="https://klasbook.be/pricing"
             style="display:inline-block;padding:8px 16px;border-radius:8px;
                    background:#fcd34d;color:#92400e;font-weight:700;font-size:12px;
                    text-decoration:none;margin-top:8px">
            Réabonner avec -20% →
          </a>
        </div>
        ${surveyUrl ? `
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 24px">
          Ton avis nous aide à améliorer Klasbook.
          <a href="${surveyUrl}" style="color:#0A84FF">Partage ton retour en 2 minutes</a>.
        </p>
        ` : ''}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:11px;color:#94a3b8;margin:0">
          <strong>GDPR Art. 17 — Droit à l'oubli :</strong>
          Si tu souhaites supprimer complètement ton compte et toutes tes données,
          écris à <a href="mailto:support@klasbook.be?subject=Suppression%20de%20compte" style="color:#0A84FF">support@klasbook.be</a>
          avec le sujet "Suppression de compte".
        </p>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to,
      subject: "Ton abonnement Klasbook a été annulé",
      html,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
