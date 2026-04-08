import { NextRequest, NextResponse } from "next/server";
import { rfqSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = rfqSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Dados inválidos", issues: validated.error.issues },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Send confirmation email to client + internal notification if Resend is configured
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const productLabel =
        data.products?.map((p) => `${p.name} ×${p.quantity}`).join(", ") ||
        data.objective.slice(0, 80);

      // Client confirmation
      await resend.emails.send({
        from: "yourgift.pt <gera@yourgift.pt>",
        to: data.email,
        subject: "Recebemos o teu pedido de proposta — yourgift.pt",
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #07111F; padding: 32px; border-radius: 12px; margin-bottom: 24px;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Pedido recebido ✓</h1>
            </div>
            <p>Olá <strong>${data.name}</strong>,</p>
            <p>Recebemos o teu pedido de proposta.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Empresa</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.company}</td></tr>
              <tr><td style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Produtos</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${productLabel}</td></tr>
              <tr><td style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Quantidade</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.quantity} unidades</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Prazo pretendido</td><td style="padding: 8px 0;">${data.deadline}</td></tr>
            </table>
            <p>A nossa equipa analisará o teu pedido e entrará em contacto em <strong>até 24 horas úteis</strong>.</p>
            <p style="color: #666; font-size: 13px;">yourgift.pt · Lisboa, Portugal · <a href="mailto:gera@yourgift.pt">gera@yourgift.pt</a></p>
          </div>
        `,
      });

      // Internal notification
      const internalTo = process.env.INTERNAL_NOTIFICATION_EMAIL || "rfq@yourgift.pt";
      await resend.emails.send({
        from: "yourgift.pt <gera@yourgift.pt>",
        to: internalTo,
        subject: `[RFQ] Novo pedido de ${data.name} — ${data.company}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
            <h2>Novo RFQ recebido</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Nome</td><td>${data.name}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Email</td><td>${data.email}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Empresa</td><td>${data.company}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Telefone</td><td>${data.phone || "—"}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Produtos</td><td>${productLabel}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Quantidade</td><td>${data.quantity}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Prazo</td><td>${data.deadline}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold;">Orçamento</td><td>${data.budget}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold; vertical-align: top;">Objetivo</td><td>${data.objective}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #666; font-weight: bold; vertical-align: top;">Notas</td><td>${data.notes || "—"}</td></tr>
            </table>
          </div>
        `,
      });
    }

    return NextResponse.json(
      { success: true, message: "Pedido recebido. Entraremos em contacto em até 24 horas." },
      { status: 201 }
    );
  } catch (err) {
    console.error("RFQ route error:", err);
    return NextResponse.json({ error: "Erro interno. Tenta novamente." }, { status: 500 });
  }
}
