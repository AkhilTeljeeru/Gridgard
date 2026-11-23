import { jsPDF } from 'jspdf';
import type { SimulationScenario } from '../types/grid';
import { SIMULATION_TYPE_LABELS } from './simulationEngine';

function safeDisplay(val: unknown): string {
  if (val === null || val === undefined) return 'Not available';
  const s = String(val).trim();
  return s.length > 0 ? s : 'Not available';
}

/**
 * Generates and downloads a structured engineering Decision Support Report PDF
 * directly via Blob download (iframe-safe, zero window.open/popups).
 */
export function exportSimulationDecisionReportPdf(scenario: SimulationScenario): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (needed: number) => {
    if (y + needed > 276) {
      doc.addPage();
      y = 16;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('GridGuard AI — What-If Simulation Decision Support Report', margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Simulation ID: ${scenario.scenarioCode} (${scenario.id})   |   Source: ${scenario.source}   |   Advisory Only`,
    margin,
    20
  );

  y = 36;

  // Metadata Block
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Scenario Metadata & Engineering Provenance', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const metaRows: Array<[string, string]> = [
    ['Scenario Type', SIMULATION_TYPE_LABELS[scenario.scenarioType]],
    ['Engineer', `${scenario.creatorName} (${safeDisplay(scenario.creatorEmail)})`],
    ['Date & Time (Created)', `${scenario.createdAt.replace('T', ' ').slice(0, 19)} UTC`],
    ['Scheduled / Operation Window', `${scenario.timeOfOperation.replace('T', ' ').slice(0, 19)} UTC (${scenario.expectedDurationMin} min)`],
    ['Linked Incident / Fault', `${safeDisplay(scenario.incidentId)} / ${safeDisplay(scenario.faultId)}`],
    ['Substation / Source -> Target', `${safeDisplay(scenario.substationId)} | ${scenario.sourceFeederId} -> ${scenario.targetFeederId} (Tie: ${scenario.tieSwitchId})`]
  ];

  for (const [label, value] of metaRows) {
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(value, contentWidth - 52);
    doc.text(wrapped, margin + 52, y);
    y += Math.max(5, wrapped.length * 4.4);
  }

  y += 3;
  ensureSpace(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Scenario Description & Assumptions', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(`${scenario.title}. ${scenario.assumptionsLog}`, contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 4.4 + 4;

  // Selected Assets
  ensureSpace(24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. Participating Canonical Assets', margin, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 4, contentWidth, 6, 'F');
  doc.text('Asset ID', margin + 2, y);
  doc.text('Asset Name', margin + 38, y);
  doc.text('Type', margin + 108, y);
  doc.text('Role', margin + 142, y);
  doc.text('Source', margin + 165, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  for (const asset of scenario.simulationAssets) {
    ensureSpace(6);
    doc.text(asset.assetId.slice(0, 20), margin + 2, y);
    doc.text(asset.assetName.slice(0, 36), margin + 38, y);
    doc.text(asset.assetType.slice(0, 16), margin + 108, y);
    doc.text(asset.role, margin + 142, y);
    doc.text(asset.source, margin + 165, y);
    y += 5;
  }

  y += 4;
  // Estimated Impact
  ensureSpace(34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('4. Estimated Impact Analysis (Before vs After)', margin, y);
  y += 6;

  const impact = scenario.impactAnalysis;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const impactLines: string[] = [
    `Consumers Affected: ${safeDisplay(impact.consumersAffectedBefore)} -> ${safeDisplay(impact.consumersAffectedAfter)} (Restored: ${safeDisplay(impact.consumersRestored)})`,
    `Transformers Affected: ${impact.transformersAffectedCount} (${impact.affectedTransformerIds.join(', ') || 'None'})`,
    `Feeders Affected: ${impact.feedersAffectedCount} (${impact.affectedFeederIds.join(', ')})`,
    `Network Utilization: ${impact.networkUtilizationBeforePct}% -> ${impact.networkUtilizationAfterPct}%`,
    `Target Feeder Loading: ${scenario.targetFeederPreLoadMva.toFixed(2)} -> ${scenario.targetFeederPostLoadMva.toFixed(2)} / ${scenario.targetFeederCapacityMva.toFixed(1)} MVA`,
    `Minimum Bus Voltage: ${scenario.minBusVoltagePu.toFixed(3)} p.u.   |   Expected Outage / Window Duration: ${impact.expectedOutageDurationMin} min`
  ];
  for (const line of impactLines) {
    ensureSpace(5);
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.4;
  }

  y += 4;
  // Risk Assessment
  ensureSpace(24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const riskColor: [number, number, number] =
    scenario.riskAssessment.level === 'HIGH'
      ? [220, 38, 38]
      : scenario.riskAssessment.level === 'MEDIUM'
        ? [217, 119, 6]
        : [22, 163, 74];
  doc.text('5. Operational Risk Assessment:', margin, y);
  doc.setTextColor(...riskColor);
  doc.text(`${scenario.riskAssessment.level} RISK`, margin + 58, y);
  doc.setTextColor(15, 23, 42);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const reason of scenario.riskAssessment.reasons) {
    ensureSpace(6);
    const wrapped = doc.splitTextToSize(`- ${reason}`, contentWidth - 4);
    doc.text(wrapped, margin + 2, y);
    y += wrapped.length * 4.4;
  }

  y += 4;
  // Recommendation
  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('6. Explainable Recommendation (Advisory — Requires Human Approval)', margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const recTitle = doc.splitTextToSize(scenario.recommendation.title, contentWidth);
  doc.text(recTitle, margin, y);
  y += recTitle.length * 4.6 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const reason of scenario.recommendation.reasons) {
    ensureSpace(6);
    const wrapped = doc.splitTextToSize(`- ${reason}`, contentWidth - 4);
    doc.text(wrapped, margin + 2, y);
    y += wrapped.length * 4.4;
  }

  y += 3;
  ensureSpace(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommended Advisory Switching Sequence:', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  scenario.recommendation.switchingSequence.forEach((step, idx) => {
    ensureSpace(6);
    const wrapped = doc.splitTextToSize(`${idx + 1}. ${step}`, contentWidth - 4);
    doc.text(wrapped, margin + 2, y);
    y += wrapped.length * 4.4;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Generated by GridGuard AI Decision Support Engine. No automated SCADA switching commands are emitted.',
    margin,
    286
  );

  doc.save(`GridGuard-Simulation-${scenario.scenarioCode}.pdf`);
}
