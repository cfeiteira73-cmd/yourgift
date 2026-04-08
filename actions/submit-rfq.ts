"use server";

import { rfqSchema, type RFQInput } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function submitRFQ(data: RFQInput) {
  // Validate
  const validated = rfqSchema.safeParse(data);
  if (!validated.success) {
    throw new Error("Invalid RFQ data");
  }

  const rfq = validated.data;

  try {
    // 1. Save to database (Prisma)
    // In production: await prisma.rFQ.create({ data: { ...rfq } })
    // For now, we simulate a save
    await simulateSave(rfq);

    // 2. Send confirmation email to customer
    await sendConfirmationEmail(rfq);

    // 3. Send notification to team
    await sendInternalNotification(rfq);

    revalidatePath("/rfq");

    return { success: true };
  } catch (error) {
    console.error("RFQ submission error:", error);
    throw new Error("Failed to submit RFQ");
  }
}

async function simulateSave(rfq: RFQInput) {
  // Simulate async DB write
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("RFQ saved:", rfq.email, rfq.company);
}

async function sendConfirmationEmail(rfq: RFQInput) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: `yourgift <${process.env.RESEND_FROM_EMAIL || "hello@yourgift.pt"}>`,
      to: rfq.email,
      subject: "Recebemos o teu pedido de proposta — yourgift.pt",
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #07111F; color: #F5F7FB; padding: 40px;">
          <h1 style="color: #4DA3FF; font-size: 24px; margin-bottom: 16px;">Recebemos o teu pedido!</h1>
          <p style="color: rgba(245,247,251,0.7); margin-bottom: 24px;">
            Olá ${rfq.name},<br><br>
            Recebemos o teu pedido de proposta para <strong>${rfq.company}</strong>.
            A nossa equipa vai analisá-lo e entrar em contacto em até <strong>48 horas úteis</strong>.
          </p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="color: rgba(245,247,251,0.5); font-size: 12px; margin-bottom: 4px;">RESUMO DO PEDIDO</p>
            <p style="color: #F5F7FB;"><strong>Objetivo:</strong> ${rfq.objective.substring(0, 100)}...</p>
            <p style="color: #F5F7FB;"><strong>Budget:</strong> ${rfq.budget}</p>
          </div>
          <p style="color: rgba(245,247,251,0.5); font-size: 13px;">
            Questões? Responde a este email ou contacta-nos em
            <a href="mailto:hello@yourgift.pt" style="color: #4DA3FF;">hello@yourgift.pt</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

async function sendInternalNotification(rfq: RFQInput) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: `yourgift Sistema <${process.env.RESEND_FROM_EMAIL || "hello@yourgift.pt"}>`,
      to: process.env.RESEND_FROM_EMAIL || "hello@yourgift.pt",
      subject: `Nova RFQ: ${rfq.company} — ${rfq.budget}`,
      html: `
        <h2>Nova proposta recebida</h2>
        <p><strong>Nome:</strong> ${rfq.name}</p>
        <p><strong>Email:</strong> ${rfq.email}</p>
        <p><strong>Empresa:</strong> ${rfq.company}</p>
        <p><strong>Telefone:</strong> ${rfq.phone || "N/A"}</p>
        <p><strong>Objetivo:</strong> ${rfq.objective}</p>
        <p><strong>Budget:</strong> ${rfq.budget}</p>
        <p><strong>Prazo:</strong> ${rfq.deadline}</p>
        <p><strong>Quantidade:</strong> ${rfq.quantity}</p>
        <p><strong>Notas:</strong> ${rfq.notes || "N/A"}</p>
      `,
    });
  } catch (err) {
    console.error("Internal notification error:", err);
  }
}
