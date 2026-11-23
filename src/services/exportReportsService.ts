import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type {
  ActiveFault,
  AiIntelligenceSnapshot,
  AuditLog,
  EngineeringDecision,
  ExportFormat,
  ExportReportType,
  InfrastructureAsset,
  MaintenanceZone,
  RegionalPerformanceKpi,
  SimulationScenario
} from '../types/grid.ts';
import { formatMissingValue } from './syntheticData.ts';

export interface ExportReportDataset {
  reportType: ExportReportType;
  scopeLabel: string;
  actorName: string;
  actorEmail: string;
  faults: ActiveFault[];
  assets: InfrastructureAsset[];
  maintenanceZones: MaintenanceZone[];
  scenarios: SimulationScenario[];
  auditLogs: AuditLog[];
  aiSnapshot: AiIntelligenceSnapshot;
  decisions?: EngineeringDecision[];
  regionalKpis?: RegionalPerformanceKpi[];
}

export interface BuiltReportTable {
  title: string;
  fileStem: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

/**
 * Neutralize spreadsheet formula injection (=, +, -, @, tab, CR) on untrusted string cells.
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function buildReportTable(dataset: ExportReportDataset): BuiltReportTable {
  const {
    reportType,
    faults,
    assets,
    maintenanceZones,
    scenarios,
    auditLogs,
    aiSnapshot,
    decisions = [],
    regionalKpis = []
  } = dataset;
  const healthById = new Map(aiSnapshot.healthScores.map((h) => [h.assetId, h]));

  switch (reportType) {
    case 'INCIDENTS':
      return {
        title: 'GridGuard AI – Incident & Active Fault Report',
        fileStem: 'gridguard-incidents-report',
        headers: [
          'Fault Code',
          'Title',
          'Severity',
          'Status',
          'Affected Asset',
          'Substation',
          'Feeder',
          'Customers Interrupted',
          'Detected At (UTC)',
          'Source'
        ],
        rows: faults.map((f) => [
          f.faultCode,
          f.title,
          f.severity,
          f.status,
          f.affectedAssetId,
          formatMissingValue(f.affectedSubstationId),
          formatMissingValue(f.affectedFeederId),
          f.customersInterrupted ?? 'Pending AMI',
          f.detectedAt,
          f.source
        ])
      };

    case 'ASSETS':
      return {
        title: 'GridGuard AI – Utility Asset Inventory & AI Health Report',
        fileStem: 'gridguard-assets-report',
        headers: [
          'Canonical ID',
          'Name',
          'Asset Type',
          'Status',
          'AI Health Score',
          'Health Category',
          'Voltage',
          'State',
          'District',
          'Area',
          'Source'
        ],
        rows: assets.map((a) => {
          const h = healthById.get(a.canonicalId);
          return [
            a.canonicalId,
            formatMissingValue(a.rawName ?? a.name),
            a.assetType,
            a.status,
            h ? h.healthScore : 'N/A',
            h ? h.category : 'N/A',
            formatMissingValue(a.voltage),
            formatMissingValue(a.state),
            formatMissingValue(a.district),
            formatMissingValue(a.area),
            a.source
          ];
        })
      };

    case 'MAINTENANCE':
      return {
        title: 'GridGuard AI – Preventive Maintenance Priority & Work Zones Report',
        fileStem: 'gridguard-maintenance-report',
        headers: [
          'Asset / Zone ID',
          'Asset / Zone Name',
          'Priority',
          'Health Score',
          'Failure Prob (%)',
          'Recommended Window',
          'Reason Summary'
        ],
        rows: [
          ...aiSnapshot.maintenanceQueue.map((item) => [
            item.assetId,
            item.assetName,
            item.priority,
            item.healthScore,
            item.failureProbabilityPct,
            item.recommendedWindow,
            item.reasonSummary
          ]),
          ...maintenanceZones.map((zone) => [
            zone.workOrderNumber,
            zone.zoneName,
            zone.status,
            'Zone',
            'N/A',
            `${zone.scheduledStart.slice(0, 16)} -> ${zone.scheduledEnd.slice(0, 16)}`,
            zone.purpose
          ])
        ]
      };

    case 'SIMULATIONS':
      return {
        title: 'GridGuard AI – What-If Operational Simulation Scenarios Report',
        fileStem: 'gridguard-simulations-report',
        headers: [
          'Scenario Code',
          'Type',
          'Status',
          'Source Feeder',
          'Target Feeder',
          'Transfer (MVA)',
          'Post Load (%)',
          'Min Voltage (p.u.)',
          'Risk Level',
          'Recommendation'
        ],
        rows: scenarios.map((s) => [
          s.scenarioCode,
          s.scenarioType,
          s.status,
          s.sourceFeederId,
          s.targetFeederId,
          s.transferredLoadMva,
          s.impactAnalysis.networkUtilizationAfterPct,
          s.minBusVoltagePu,
          s.riskAssessment.level,
          s.recommendation.title
        ])
      };

    case 'AUDIT_LOGS':
      return {
        title: 'GridGuard AI – Cryptographic Operational Audit Trail',
        fileStem: 'gridguard-audit-logs-report',
        headers: [
          'Timestamp (UTC)',
          'Actor Email',
          'Role',
          'Action Type',
          'Module',
          'Target Entity',
          'Entity ID',
          'Summary'
        ],
        rows: auditLogs.map((log) => [
          log.timestamp,
          log.actorEmail,
          log.actorRole,
          log.actionType,
          log.module || 'Operations',
          log.targetEntity,
          log.entityId,
          log.summary
        ])
      };

    case 'AI_RECOMMENDATIONS':
      return {
        title: 'GridGuard AI – Explainable AI Recommendations & Predictions Report',
        fileStem: 'gridguard-ai-recommendations-report',
        headers: [
          'Recommendation ID',
          'Asset ID',
          'Asset Name',
          'Priority',
          'Health Score',
          'Confidence (%)',
          'Expected Risk Reduction (%)',
          'Recommendation',
          'Explainable Reasons'
        ],
        rows: aiSnapshot.recommendations.map((rec) => [
          rec.id,
          rec.assetId,
          rec.assetName,
          rec.priority,
          rec.healthScore,
          rec.confidenceScore,
          rec.expectedRiskReductionPct,
          rec.recommendation,
          rec.reasons.join(' | ')
        ])
      };

    case 'GRID_HEALTH':
      return {
        title: 'GridGuard AI – Executive Grid Health & Risk Index Report',
        fileStem: 'gridguard-grid-health-report',
        headers: [
          'Scope Level',
          'Entity / Region',
          'Parent Scope',
          'Risk Score',
          'Risk Level',
          'Avg Health',
          'Active Incidents',
          'Avg Load (%)'
        ],
        rows: aiSnapshot.riskIndices.map((r) => [
          r.scopeLevel,
          r.name,
          r.parentLabel,
          r.riskScore,
          r.riskLevel,
          r.avgAssetHealth,
          r.activeIncidentsCount,
          r.avgLoadPct
        ])
      };

    case 'REGIONAL_PERFORMANCE':
      return {
        title: 'GridGuard AI – Regional Performance Analytics (MTTR / MTBF)',
        fileStem: 'gridguard-regional-performance-report',
        headers: [
          'Scope Level',
          'Region / Substation',
          'Reliability (%)',
          'Availability (%)',
          'Fault Freq (/100km)',
          'MTTR (hrs)',
          'MTBF (hrs)',
          'Maint Compliance (%)',
          'Response (min)'
        ],
        rows: regionalKpis.map((k) => [
          k.scopeLevel,
          k.regionName,
          k.gridReliabilityPct,
          k.assetAvailabilityPct,
          k.faultFrequencyPer100Km,
          k.mttrHours,
          k.mtbfHours,
          k.maintenanceCompliancePct,
          k.avgResponseTimeMin
        ])
      };

    case 'ASSET_RELIABILITY':
      return {
        title: 'GridGuard AI – Asset Reliability & Failure Forecast Report',
        fileStem: 'gridguard-asset-reliability-report',
        headers: [
          'Asset ID',
          'Asset Name',
          'Type',
          'Health Score',
          'Category',
          'Age (Yrs)',
          'Faults (Hist)',
          'Downtime 90d (hrs)',
          'Peak Load (%)'
        ],
        rows: aiSnapshot.healthScores.map((h) => [
          h.assetId,
          h.assetName,
          h.assetType,
          h.healthScore,
          h.category,
          h.ageYears,
          h.historicalFaultCount,
          h.downtimeHours90d,
          h.peakLoadPct
        ])
      };

    case 'DECISION_GOVERNANCE':
      return {
        title: 'GridGuard AI – Decision Governance & Approval Traceability Report',
        fileStem: 'gridguard-decision-governance-report',
        headers: [
          'Decision Code',
          'Title',
          'Target Asset',
          'Priority',
          'Risk Level',
          'Status',
          'Proposed By',
          'Reviewed By',
          'Created At (UTC)'
        ],
        rows: decisions.map((d) => [
          d.decisionCode,
          d.title,
          d.targetAssetId,
          d.priority || 'MEDIUM',
          d.riskLevel || 'MEDIUM',
          d.status,
          d.proposedBy,
          d.reviewedBy || 'Pending Review',
          d.createdAt
        ])
      };
  }
}

export function buildCsvContent(table: BuiltReportTable): string {
  const escapeCell = (raw: string | number): string => {
    const safe = sanitizeSpreadsheetCell(raw);
    if (/[",\n\r]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };
  const headerLine = table.headers.map(escapeCell).join(',');
  const dataLines = table.rows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportOperationalReport(
  dataset: ExportReportDataset,
  format: ExportFormat
): { filename: string; rowCount: number } {
  const table = buildReportTable(dataset);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'CSV') {
    const csv = buildCsvContent(table);
    const filename = `${table.fileStem}-${stamp}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(blob, filename);
    return { filename, rowCount: table.rows.length };
  }

  if (format === 'EXCEL') {
    const wb = XLSX.utils.book_new();
    const metaRows = [
      ['Report Title', table.title],
      ['Generated At (UTC)', new Date().toISOString()],
      ['Geographic Scope', sanitizeSpreadsheetCell(dataset.scopeLabel)],
      ['Generated By', sanitizeSpreadsheetCell(`${dataset.actorName} (${dataset.actorEmail})`)],
      ['Advisory Notice', 'GridGuard AI is a human-in-the-loop decision-support system.'],
      ['Total Records', table.rows.length]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(metaRows);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    const safeData = [
      table.headers.map((h) => sanitizeSpreadsheetCell(h)),
      ...table.rows.map((r) =>
        r.map((cell) => (typeof cell === 'number' ? cell : sanitizeSpreadsheetCell(cell)))
      )
    ];
    const dataSheet = XLSX.utils.aoa_to_sheet(safeData);
    XLSX.utils.book_append_sheet(wb, dataSheet, 'ReportData');

    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const filename = `${table.fileStem}-${stamp}.xlsx`;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    triggerBrowserDownload(blob, filename);
    return { filename, rowCount: table.rows.length };
  }

  // PDF Export via jsPDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = 40;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(table.title, margin, 32);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Scope: ${dataset.scopeLabel} | Actor: ${dataset.actorName} | Generated: ${new Date().toISOString()}`,
    margin,
    50
  );
  doc.text(
    'Decision-Support Notice: Advisory engineering evidence only — zero autonomous grid switching.',
    margin,
    63
  );

  y = 94;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  const colWidth = (pageWidth - margin * 2) / Math.min(table.headers.length, 6);
  const visibleCols = Math.min(table.headers.length, 6);

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F');
  for (let c = 0; c < visibleCols; c += 1) {
    doc.text(String(table.headers[c]).slice(0, 22), margin + c * colWidth + 4, y);
  }
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const maxRows = Math.min(table.rows.length, 150);
  for (let r = 0; r < maxRows; r += 1) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 40;
    }
    const row = table.rows[r];
    for (let c = 0; c < visibleCols; c += 1) {
      const text = String(row[c] ?? '').slice(0, 26);
      doc.text(text, margin + c * colWidth + 4, y);
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);
    y += 16;
  }

  const filename = `${table.fileStem}-${stamp}.pdf`;
  doc.save(filename);
  return { filename, rowCount: table.rows.length };
}
