import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArtworkAnalysis {
  score: number;               // 0-100
  printSafe: boolean;
  resolution: 'high' | 'medium' | 'low' | 'vector' | 'unknown';
  colorMode: 'CMYK' | 'RGB' | 'pantone' | 'unknown';
  issues: string[];
  suggestions: string[];
  verdict: 'approved' | 'review' | 'rejected';
  details: string;
}

// ── System prompt for artwork analysis ───────────────────────────────────────

const ARTWORK_SYSTEM = `És um especialista sénior em pré-impressão e produção gráfica com 20 anos de experiência.
Analisa artes finais para produção de merchandising personalizado (t-shirts, canecas, sacos, material corporativo).

Avalia com rigor técnico e retorna um JSON estruturado com os seguintes campos OBRIGATÓRIOS:
- score: número de 0 a 100 (qualidade geral para produção)
- printSafe: boolean (true = pronto para produção, false = precisa de ajustes)
- resolution: "high" | "medium" | "low" | "vector" | "unknown"
- colorMode: "CMYK" | "RGB" | "pantone" | "unknown"
- issues: array de strings com problemas encontrados (vazio se não há problemas)
- suggestions: array de strings com sugestões de melhoria (máximo 3)
- verdict: "approved" | "review" | "rejected"
- details: string curta (1-2 frases) com resumo da análise

Critérios de avaliação:
- Resolução: SVG/EPS/AI = vector (score alto), PNG/JPG ≥300dpi = high, <150dpi = low
- Cor: CMYK é preferível para impressão offset/serigrafia; RGB pode ter desvios de cor
- Ficheiros vector são sempre preferíveis para personalizações
- Logótipos devem ter fundo transparente ou limpo
- Texto deve ser convertido em curvas/outlines para evitar problemas de fontes
- Margens de segurança: 3mm mínimo para corte recto

RESPONDE APENAS COM JSON VÁLIDO. Sem texto extra, sem markdown code blocks.`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { imageUrl, fileName, fileType, fileSize } = body as {
      imageUrl?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    };

    if (!fileName && !imageUrl) {
      return NextResponse.json({ error: 'fileName or imageUrl required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback analysis based on file metadata
      return NextResponse.json(buildFallbackAnalysis(fileName ?? '', fileType ?? '', fileSize ?? 0));
    }

    // Build the analysis prompt based on available info
    const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
    const isVector = ['svg', 'ai', 'eps'].includes(ext);
    const isPdf = ext === 'pdf';
    const isRaster = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

    let messages: Array<{ role: 'user'; content: string | Array<{ type: string; [key: string]: unknown }> }>;

    // If we have an image URL and it's a raster image, use vision
    if (imageUrl && isRaster) {
      try {
        // Fetch the image and convert to base64
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buf).toString('base64');
          const mimeType = fileType ?? imgRes.headers.get('content-type') ?? 'image/png';
          // Limit: Anthropic accepts images up to ~5MB
          if (buf.byteLength < 5 * 1024 * 1024) {
            messages = [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mimeType, data: base64 },
                },
                {
                  type: 'text',
                  text: `Analisa esta arte para produção de merchandising.
Ficheiro: ${fileName ?? 'imagem'}
Tipo: ${fileType ?? ext}
Tamanho: ${fileSize ? `${(fileSize / 1024).toFixed(0)} KB` : 'desconhecido'}

Retorna apenas JSON com os campos: score, printSafe, resolution, colorMode, issues, suggestions, verdict, details.`,
                },
              ],
            }];
          } else {
            throw new Error('Image too large for vision');
          }
        } else {
          throw new Error('Could not fetch image');
        }
      } catch {
        // Fall back to metadata-only analysis
        messages = buildMetadataMessage(fileName ?? '', fileType ?? '', fileSize ?? 0, ext);
      }
    } else {
      // Text-only analysis based on file metadata
      messages = buildMetadataMessage(fileName ?? '', fileType ?? '', fileSize ?? 0, ext);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: isRaster && imageUrl ? 'claude-3-5-sonnet-20241022' : 'claude-3-haiku-20240307',
        max_tokens: 512,
        system: ARTWORK_SYSTEM,
        messages,
      }),
    });

    if (!res.ok) {
      console.error('Anthropic artwork analyze error:', res.status);
      return NextResponse.json(buildFallbackAnalysis(fileName ?? '', fileType ?? '', fileSize ?? 0));
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.type === 'text' ? data.content[0].text : '';

    try {
      const analysis = JSON.parse(rawText) as ArtworkAnalysis;
      // Validate required fields
      if (typeof analysis.score !== 'number') throw new Error('invalid');
      return NextResponse.json(analysis);
    } catch {
      // Parse failure — return fallback
      return NextResponse.json(buildFallbackAnalysis(fileName ?? '', fileType ?? '', fileSize ?? 0));
    }
  } catch (error) {
    console.error('Artwork analyze error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMetadataMessage(
  fileName: string,
  fileType: string,
  fileSize: number,
  ext: string,
): Array<{ role: 'user'; content: string }> {
  return [{
    role: 'user',
    content: `Analisa esta arte para produção de merchandising com base nos metadados:
Ficheiro: ${fileName}
Extensão: ${ext}
Tipo MIME: ${fileType || 'desconhecido'}
Tamanho: ${fileSize ? `${(fileSize / 1024).toFixed(0)} KB` : 'desconhecido'}

Faz uma análise técnica baseada no tipo de ficheiro e retorna apenas JSON.`,
  }];
}

function buildFallbackAnalysis(fileName: string, fileType: string, fileSize: number): ArtworkAnalysis {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const isVector = ['svg', 'ai', 'eps'].includes(ext);
  const isPdf = ext === 'pdf';
  const isPng = ext === 'png';
  const isJpg = ['jpg', 'jpeg'].includes(ext);

  if (isVector) {
    return {
      score: 95, printSafe: true, resolution: 'vector', colorMode: 'unknown',
      issues: [], verdict: 'approved',
      suggestions: ['Confirma que o texto está em curvas/outlines', 'Verifica se o fundo é transparente'],
      details: 'Ficheiro vectorial de alta qualidade — ideal para todos os processos de impressão.',
    };
  }
  if (isPdf) {
    return {
      score: 85, printSafe: true, resolution: 'high', colorMode: 'CMYK',
      issues: [], verdict: 'approved',
      suggestions: ['Confirma que as fontes estão embebidas', 'Verifica as margens de corte'],
      details: 'PDF geralmente adequado para produção. Verificação manual recomendada para ficheiros complexos.',
    };
  }
  if (isPng) {
    const sizeKB = fileSize / 1024;
    const score = sizeKB > 500 ? 78 : sizeKB > 100 ? 65 : 45;
    return {
      score, printSafe: score >= 70, resolution: score >= 70 ? 'high' : 'medium', colorMode: 'RGB',
      issues: score < 70 ? ['Resolução possivelmente baixa para impressão', 'Modo RGB pode causar desvio de cores'] : ['Modo RGB pode causar desvio de cores'],
      suggestions: ['Converte para CMYK antes de enviar para produção', 'Garante 300dpi mínimo na resolução', 'Considera converter para SVG/EPS se possível'],
      verdict: score >= 70 ? 'review' : 'rejected',
      details: `PNG ${score >= 70 ? 'com resolução aceitável' : 'com resolução insuficiente'}. Conversão para modo CMYK recomendada para fidelidade de cores.`,
    };
  }
  if (isJpg) {
    return {
      score: 55, printSafe: false, resolution: 'medium', colorMode: 'RGB',
      issues: ['JPG tem compressão com perda (artefactos)', 'Modo RGB inadequado para impressão profissional', 'Sem suporte a transparência'],
      suggestions: ['Usa PNG de alta resolução ou formato vectorial', 'Converte para CMYK', 'Resolução mínima: 300dpi a 100%'],
      verdict: 'review',
      details: 'JPG não é ideal para merchandising. Solicita formato vectorial ou PNG de alta resolução ao designer.',
    };
  }
  return {
    score: 60, printSafe: false, resolution: 'unknown', colorMode: 'unknown',
    issues: ['Formato desconhecido — verificação manual necessária'],
    suggestions: ['Usa SVG, PDF, AI ou PNG 300dpi para melhores resultados'],
    verdict: 'review',
    details: 'Formato não reconhecido. Verificação manual recomendada antes de enviar para produção.',
  };
}
