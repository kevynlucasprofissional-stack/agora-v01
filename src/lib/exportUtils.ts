import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";
import { AnalysisRequest } from "@/types/database";

export async function exportToDocx(analysis: AnalysisRequest, payload: Record<string, any> | null) {
  const title = analysis.title || "Relatório Executivo";
  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }));

  // Date
  children.push(new Paragraph({
    children: [new TextRun({ text: new Date(analysis.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), color: "888888", size: 20 })],
    spacing: { after: 400 },
  }));

  // Scores
  children.push(new Paragraph({ text: "Scores", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Score Geral: ${Number(analysis.score_overall ?? 0).toFixed(0)}/100`, bold: true, size: 28 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Sociocomportamental: ${Number(analysis.score_sociobehavioral ?? 0).toFixed(0)}/100`, size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Oferta: ${Number(analysis.score_offer ?? 0).toFixed(0)}/100`, size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Performance: ${Number(analysis.score_performance ?? 0).toFixed(0)}/100`, size: 22 })], spacing: { after: 300 } }));

  // Contexto
  const ctxParts: string[] = [];
  const industry = payload?.industry ?? analysis.industry;
  const channel = payload?.primary_channel ?? analysis.primary_channel;
  const region = payload?.region ?? analysis.region;
  const audienceDeclared = payload?.declared_target_audience ?? analysis.declared_target_audience;
  if (industry) ctxParts.push(`Indústria: ${industry}`);
  if (channel) ctxParts.push(`Canal: ${channel}`);
  if (region) ctxParts.push(`Região: ${region}`);
  if (audienceDeclared) ctxParts.push(`Público declarado: ${audienceDeclared}`);
  if (ctxParts.length) {
    children.push(new Paragraph({ text: "Contexto da Análise", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    for (const c of ctxParts) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${c}`, size: 22 })], spacing: { after: 60 } }));
    }
  }

  // Marketing Era
  if (payload?.marketing_era) {
    children.push(new Paragraph({ text: `Era do Marketing: ${payload.marketing_era.era}`, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: payload.marketing_era.description, size: 22 })], spacing: { after: 100 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Recomendação: ${payload.marketing_era.recommendation}`, italics: true, size: 22 })], spacing: { after: 300 } }));
  }

  // IBGE Insights
  if (payload?.ibge_insights) {
    const ibge = payload.ibge_insights;
    children.push(new Paragraph({ text: "Dados Demográficos (IBGE)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    if (typeof ibge === "string") {
      children.push(new Paragraph({ children: [new TextRun({ text: ibge, size: 22 })], spacing: { after: 200 } }));
    } else {
      if (ibge.demographic_summary) children.push(new Paragraph({ children: [new TextRun({ text: ibge.demographic_summary, size: 22 })], spacing: { after: 100 } }));
      if (ibge.relevance) children.push(new Paragraph({ children: [new TextRun({ text: `Relevância: ${ibge.relevance}`, italics: true, size: 22 })], spacing: { after: 200 } }));
    }
  }

  // Executive Summary
  if (payload?.executive_summary) {
    children.push(new Paragraph({ text: "Resumo Executivo", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: payload.executive_summary, size: 22 })], spacing: { after: 300 } }));
  }

  // Hormozi
  if (payload?.hormozi_analysis) {
    const h = payload.hormozi_analysis;
    children.push(new Paragraph({ text: "Análise de Valor (Hormozi)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Resultado Sonhado: ${h.dream_outcome}/5 | Probabilidade: ${h.perceived_likelihood}/5 | Rapidez: ${h.time_delay}/5 | Facilidade: ${h.effort_sacrifice}/5`, size: 22 })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: h.overall_value, size: 22 })], spacing: { after: 300 } }));
  }

  // Improvements
  if (payload?.improvements?.length) {
    children.push(new Paragraph({ text: "Gargalos Identificados", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    for (const imp of payload.improvements) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${imp}`, size: 22 })], spacing: { after: 60 } }));
    }
  }

  // Strengths
  if (payload?.strengths?.length) {
    children.push(new Paragraph({ text: "Pontos Fortes", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    for (const s of payload.strengths) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${s}`, size: 22 })], spacing: { after: 60 } }));
    }
  }

  // Audience
  if (payload?.audience_insights?.length) {
    children.push(new Paragraph({ text: "Audiência Sintética", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }));
    for (const a of payload.audience_insights) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${a.emoji} ${a.generation}: `, bold: true, size: 22 }), new TextRun({ text: `"${a.feedback}"`, italics: true, size: 22 })], spacing: { after: 100 } }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `relatorio-${title.slice(0, 30)}.docx`);
}

export function exportToPptx(analysis: AnalysisRequest, payload: Record<string, any> | null) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const title = analysis.title || "Relatório Executivo";

  // Slide 1: Title
  const slide1 = pptx.addSlide();
  slide1.addText(title, { x: 0.5, y: 1.5, w: 12, h: 1.5, fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Arial" });
  slide1.addText(new Date(analysis.created_at).toLocaleDateString("pt-BR"), { x: 0.5, y: 3, w: 12, h: 0.5, fontSize: 16, color: "AAAAAA" });
  slide1.addText("Ágora — Auditoria de Marketing por IA", { x: 0.5, y: 4, w: 12, h: 0.5, fontSize: 14, color: "888888" });
  slide1.background = { fill: "1a1a2e" };

  // Slide 2: Scores
  const slide2 = pptx.addSlide();
  slide2.background = { fill: "1a1a2e" };
  slide2.addText("Scores da Campanha", { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: "FFFFFF" });
  const scoreData = [
    { label: "Geral", value: analysis.score_overall },
    { label: "Sociocomportamental", value: analysis.score_sociobehavioral },
    { label: "Oferta", value: analysis.score_offer },
    { label: "Performance", value: analysis.score_performance },
  ];
  scoreData.forEach((s, i) => {
    const x = 0.5 + i * 3.1;
    slide2.addText(String(Number(s.value ?? 0).toFixed(0)), { x, y: 1.5, w: 2.8, h: 1.5, fontSize: 48, bold: true, color: "4A90D9", align: "center" });
    slide2.addText(s.label, { x, y: 3, w: 2.8, h: 0.5, fontSize: 14, color: "AAAAAA", align: "center" });
  });

  // Slide 3: Era + Hormozi
  if (payload?.marketing_era || payload?.hormozi_analysis) {
    const slide3 = pptx.addSlide();
    slide3.background = { fill: "1a1a2e" };
    let yPos = 0.3;
    if (payload.marketing_era) {
      slide3.addText(`Era do Marketing: ${payload.marketing_era.era}`, { x: 0.5, y: yPos, w: 12, h: 0.8, fontSize: 28, bold: true, color: "FFFFFF" });
      slide3.addText(payload.marketing_era.description, { x: 0.5, y: yPos + 1, w: 12, h: 1, fontSize: 16, color: "CCCCCC" });
      yPos += 2.5;
    }
    if (payload.hormozi_analysis) {
      slide3.addText("Análise de Valor (Hormozi)", { x: 0.5, y: yPos, w: 12, h: 0.8, fontSize: 24, bold: true, color: "FFFFFF" });
      slide3.addText(payload.hormozi_analysis.overall_value, { x: 0.5, y: yPos + 1, w: 12, h: 1.5, fontSize: 16, color: "CCCCCC" });
    }
  }

  // Slide 4: Diagnosis
  const slide4 = pptx.addSlide();
  slide4.background = { fill: "1a1a2e" };
  slide4.addText("Diagnóstico", { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: "FFFFFF" });
  const improvements = (payload?.improvements as string[]) || [];
  const strengths = (payload?.strengths as string[]) || [];
  slide4.addText("Gargalos", { x: 0.5, y: 1.2, w: 6, h: 0.5, fontSize: 18, bold: true, color: "FF6B6B" });
  improvements.slice(0, 5).forEach((imp, i) => {
    slide4.addText(`• ${imp}`, { x: 0.5, y: 1.8 + i * 0.6, w: 6, h: 0.5, fontSize: 13, color: "CCCCCC" });
  });
  slide4.addText("Pontos Fortes", { x: 6.5, y: 1.2, w: 6, h: 0.5, fontSize: 18, bold: true, color: "51CF66" });
  strengths.slice(0, 5).forEach((s, i) => {
    slide4.addText(`• ${s}`, { x: 6.5, y: 1.8 + i * 0.6, w: 6, h: 0.5, fontSize: 13, color: "CCCCCC" });
  });

  // Slide 5: Audience
  if (payload?.audience_insights?.length) {
    const slide5 = pptx.addSlide();
    slide5.background = { fill: "1a1a2e" };
    slide5.addText("Audiência Sintética", { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: "FFFFFF" });
    (payload.audience_insights as any[]).forEach((a, i) => {
      const x = 0.5 + (i % 2) * 6.25;
      const y = 1.3 + Math.floor(i / 2) * 2.5;
      slide5.addText(`${a.emoji} ${a.generation}`, { x, y, w: 5.75, h: 0.5, fontSize: 18, bold: true, color: "FFFFFF" });
      slide5.addText(`"${a.feedback}"`, { x, y: y + 0.6, w: 5.75, h: 1.5, fontSize: 13, color: "CCCCCC", italic: true });
    });
  }

  pptx.writeFile({ fileName: `relatorio-${title.slice(0, 30)}.pptx` });
}
