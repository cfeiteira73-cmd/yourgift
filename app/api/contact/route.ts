import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  company: z.string().optional(),
  subject: z.enum(["proposta", "suporte", "parceria", "outro"]),
  message: z.string().min(20, "Mensagem muito curta"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = schema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Dados inválidos", issues: validated.error.issues },
        { status: 400 }
      );
    }

    const { name, email, company, subject, message } = validated.data;

    // Send email via Resend if API key is configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const subjectLabels: Record<string, string> = {
        proposta: "Pedir proposta",
        suporte: "Suporte técnico",
        parceria: "Parceria",
        outro: "Outro",
      };

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #07111F; border-bottom: 2px solid #4DA3FF; padding-bottom: 12px;">
            Nova mensagem via yourgift.pt
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px; width: 120px;">Nome</td>
              <td style="padding: 8px 0; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; font-weight: 600;">
                <a href="mailto:${email}" style="color: #4DA3FF;">${email}</a>
              </td>
            </tr>
            ${company ? `<tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Empresa</td>
              <td style="padding: 8px 0; font-weight: 600;">${company}</td>
            </tr>` : ""}
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Assunto</td>
              <td style="padding: 8px 0; font-weight: 600;">${subjectLabels[subject] ?? subject}</td>
            </tr>
          </table>
          <div style="background: #f5f7fa; border-radius: 8px; padding: 16px; margin-top: 12px;">
            <p style="font-size: 14px; color: #666; margin: 0 0 8px;">Mensagem:</p>
            <p style="white-space: pre-wrap; margin: 0; line-height: 1.6;">${message}</p>
          </div>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">
            Enviado via yourgift.pt · ${new Date().toLocaleString("pt-PT")}
          </p>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "yourgift.pt <noreply@yourgift.pt>",
          to: ["hello@yourgift.pt"],
          reply_to: email,
          subject: `[yourgift.pt] ${subjectLabels[subject] ?? subject} — ${name}`,
          html: emailHtml,
        }),
      });
    }

    // Log for development / fallback
    if (!resendKey) {
      console.log("[contact] New message:", { name, email, company, subject });
    }

    return NextResponse.json(
      { success: true, message: "Mensagem recebida. Respondemos em 24h úteis." },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro interno. Tenta novamente ou contacta hello@yourgift.pt." },
      { status: 500 }
    );
  }
}
