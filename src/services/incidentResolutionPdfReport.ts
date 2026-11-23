import { jsPDF } from 'jspdf';
import type {
  ActiveFault,
  EngineeringDecision,
  EventReconstructionIncident,
  FieldEvidence,
  FieldTask,
  InfrastructureAsset,
  SimulationScenario
} from '../types/grid';
import { formatMissingValue } from './syntheticData';

export interface IncidentResolutionReportInput {
  decision: EngineeringDecision;
  fault?: ActiveFault | null;
  incident?: EventReconstructionIncident | null;
  scenario?: SimulationScenario | null;
  task?: FieldTask | null;
  evidence?: FieldEvidence[];
  assets?: InfrastructureAsset[];
}

export function exportIncidentResolutionPdf(input: IncidentResolutionReportInput): void {
  const { decision, fault, incident, scenario, task, evidence = [], assets = [] } = input;
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

  const addSectionTitle = (title: string) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 5.5;
  };

  const addKeyValue = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(value, contentWidth - 48);
    doc.text(wrapped, margin + 48, y);
    y += Math.max(4.8, wrapped.length * 4.3);
  };

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text('GridGuard AI — Incident Resolution & Governance Closure Report', margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Decision: ${decision.decisionCode}   |   Status: ${decision.status}   |   Source: ${decision.source}   |   Human-Verified`,
    margin,
    20
  );

  y = 36;

  // 1. Incident Summary
  addSectionTitle('1. Incident Summary');
  addKeyValue('Decision / Case ID', `${decision.decisionCode} (${decision.id})`);
  addKeyValue('Incident / Fault ID', `${formatMissingValue(decision.incidentId || incident?.id)} / ${formatMissingValue(decision.faultId || fault?.faultCode)}`);
  addKeyValue('Geography', `${formatMissingValue(decision.area)}, ${formatMissingValue(decision.district)}, ${formatMissingValue(decision.state)}`);
  addKeyValue('Priority / Risk', `${decision.priority || 'HIGH'} Priority  |  ${decision.riskLevel || 'MEDIUM'} Risk`);
  addKeyValue('Detected At', fault ? `${fault.detectedAt.replace('T', ' ').slice(0, 19)} UTC` : `${decision.createdAt.replace('T', ' ').slice(0, 19)} UTC`);
  addKeyValue('Summary', incident?.description || fault?.description || decision.title);

  y += 2;
  // 2. Event Timeline
  addSectionTitle('2. Reconstructed Event Timeline');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  if (incident && incident.steps.length > 0) {
    for (const step of incident.steps) {
      ensureSpace(7);
      const line = `${step.stepNumber}. [${step.timestamp.replace('T', ' ').slice(0, 19)} UTC] ${step.title} (${step.assetId}) — ${step.summary}`;
      const wrapped = doc.splitTextToSize(line, contentWidth - 2);
      doc.text(wrapped, margin + 2, y);
      y += wrapped.length * 4.2 + 1;
    }
  } else {
    doc.text('No multi-step event reconstruction timeline attached; operational logs referenced in evidence bundle.', margin + 2, y);
    y += 5;
  }

  y += 2;
  // 3. Root Cause
  addSectionTitle('3. Root Cause & Technical Rationale');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const rcLines = doc.splitTextToSize(decision.rationale || 'Root cause verified via canonical network correlation.', contentWidth);
  ensureSpace(rcLines.length * 4.5 + 4);
  doc.text(rcLines, margin, y);
  y += rcLines.length * 4.4 + 3;

  // 4. Affected Assets
  addSectionTitle('4. Affected Canonical Assets');
  const affectedIds = Array.from(
    new Set([
      decision.targetAssetId,
      ...(incident?.affectedAssetIds || []),
      ...(fault?.affectedTransformerIds || []),
      ...(task ? [task.assetId] : [])
    ].filter(Boolean))
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  for (const aid of affectedIds) {
    ensureSpace(5.5);
    const asset = assets.find((a) => a.canonicalId === aid);
    const desc = asset
      ? `${aid} — ${formatMissingValue(asset.rawName ?? asset.name)} (${asset.assetType}, ${formatMissingValue(asset.voltage)}, ${asset.status})`
      : aid;
    doc.text(`• ${desc}`, margin + 2, y);
    y += 4.6;
  }

  y += 2;
  // 5. Simulation Used
  addSectionTitle('5. What-If Simulation & Advisory Model Used');
  if (scenario) {
    addKeyValue('Scenario Code', `${scenario.scenarioCode} (${scenario.scenarioType})`);
    addKeyValue('Feeder / Switch', `${scenario.sourceFeederId} -> ${scenario.targetFeederId} via ${scenario.tieSwitchId}`);
    addKeyValue('Load / Voltage', `${scenario.transferredLoadMva.toFixed(2)} MVA | Post-load ${scenario.targetFeederPostLoadMva.toFixed(2)}/${scenario.targetFeederCapacityMva.toFixed(1)} MVA | Min Bus ${scenario.minBusVoltagePu.toFixed(3)} p.u.`);
    addKeyValue('Advisory Recommendation', scenario.recommendation.title);
  } else {
    addKeyValue('Simulation ID', formatMissingValue(decision.evidenceBundle.simulationScenarioId));
    addKeyValue('Reliability Impact', decision.evidenceBundle.reliabilityImpact);
  }

  y += 2;
  // 6. Decision Taken
  addSectionTitle('6. Approved Decision & Cryptographic Governance');
  addKeyValue('Decision Title', decision.title);
  addKeyValue('Proposed By', `${decision.proposedBy} (${decision.proposedByEmail})`);
  addKeyValue('Reviewed / Approved By', `${formatMissingValue(decision.reviewedBy)} (${formatMissingValue(decision.reviewedByEmail)})`);
  addKeyValue('Risk Assessment', decision.riskAssessment);
  addKeyValue('SHA-256 Digest', decision.signatureHash);

  y += 2;
  // 7. Field Evidence
  addSectionTitle('7. Field Operations & Submitted Evidence');
  if (task) {
    addKeyValue('Field Task', `${task.taskCode} — ${task.status}`);
    addKeyValue('Assigned Crew', `${task.assignedEngineer} (${task.assignedTeam})`);
    addKeyValue('GPS & Location', `${task.gpsLat.toFixed(4)}, ${task.gpsLon.toFixed(4)} (${task.faultLocation})`);
  } else {
    addKeyValue('Field Task', 'No linked field task recorded');
  }
  if (evidence.length > 0) {
    for (const ev of evidence) {
      ensureSpace(11);
      const evLine = `• [${ev.uploadedAt.replace('T', ' ').slice(0, 19)} UTC] ${ev.fileName} (${ev.inspectionResult} / ${ev.equipmentCondition}) at GPS ${ev.gpsLat.toFixed(4)}, ${ev.gpsLon.toFixed(4)} — ${ev.notes}`;
      const wrapped = doc.splitTextToSize(evLine, contentWidth - 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      doc.text(wrapped, margin + 2, y);
      y += wrapped.length * 4.1 + 1;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.text('No field evidence attachments uploaded yet.', margin + 2, y);
    y += 5;
  }

  y += 2;
  // 8. Resolution Details & Verification Checklist
  addSectionTitle('8. Resolution Details & Manager Verification Checklist');
  const vc = decision.verificationChecklist;
  if (vc) {
    addKeyValue('Fault Resolved', vc.faultResolved ? 'CONFIRMED' : 'PENDING');
    addKeyValue('Equipment Tested', vc.equipmentTested ? 'CONFIRMED' : 'PENDING');
    addKeyValue('Power Restored', vc.powerRestored ? 'CONFIRMED' : 'PENDING');
    addKeyValue('Safety Checks Completed', vc.safetyChecksCompleted ? 'CONFIRMED' : 'PENDING');
    addKeyValue('Documentation Completed', vc.documentationCompleted ? 'CONFIRMED' : 'PENDING');
    addKeyValue('Verified By', `${formatMissingValue(vc.verifiedBy)} (${formatMissingValue(vc.verifiedAt)})`);
  } else {
    addKeyValue('Verification Checklist', 'Awaiting Utility Manager final checklist sign-off');
  }
  if (decision.resolutionSummary) {
    addKeyValue('Resolution Summary', decision.resolutionSummary);
  }

  y += 2;
  // 9. Final Status
  addSectionTitle('9. Final Operational Status');
  addKeyValue('Final Decision Status', decision.status);
  addKeyValue('Closed By / At', `${formatMissingValue(decision.closedBy)} · ${formatMissingValue(decision.closedAt)}`);
  addKeyValue('Customers Affected / Restored', formatMissingValue(decision.evidenceBundle.affectedCustomersCount, ' Accounts'));

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Generated by GridGuard AI Decision Governance & Audit Intelligence. Strictly advisory & human-verified.',
    margin,
    286
  );

  doc.save(`GridGuard-Incident-Resolution-${decision.decisionCode}.pdf`);
}
