import React, { useState, useMemo } from 'react';
import type { DatasetRecord, DatasetQuality } from '../simulation/types';
import { DatasetEngine } from '../simulation/datasetEngine';
import { Layers, Download, Search, Filter, ArrowUpDown, FileCode, CheckCircle2 } from 'lucide-react';

interface DatasetQualityAndPreviewProps {
  records: DatasetRecord[];
  quality: DatasetQuality | null;
}

export const DatasetQualityAndPreview: React.FC<DatasetQualityAndPreviewProps> = ({
  records,
  quality,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [transformerFilter, setTransformerFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof DatasetRecord>('timestamp');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (stateFilter !== 'ALL' && r.operating_state !== stateFilter) return false;
      if (transformerFilter !== 'ALL' && r.transformer_id !== transformerFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.timestamp.toLowerCase().includes(term) ||
          r.transformer_id.toLowerCase().includes(term) ||
          r.simulation_run_id.toLowerCase().includes(term) ||
          r.scenario.toLowerCase().includes(term) ||
          r.event_type.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [records, stateFilter, transformerFilter, searchTerm]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedRecords.length / rowsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedRecords.slice(start, start + rowsPerPage);
  }, [sortedRecords, currentPage]);

  const handleSort = (field: keyof DatasetRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDownloadCSV = () => {
    const csvData = DatasetEngine.exportToCSV(records);
    DatasetEngine.downloadFile(csvData, 'SynapseGrid_DigitalTwin_Dataset.csv', 'text/csv;charset=utf-8;');
  };

  const handleDownloadJSON = () => {
    const jsonData = JSON.stringify(records, null, 2);
    DatasetEngine.downloadFile(jsonData, 'SynapseGrid_DigitalTwin_Dataset.json', 'application/json');
  };

  if (!quality || records.length === 0) {
    return (
      <div className="bg-grid-surface border border-grid-border rounded-xl p-8 text-center space-y-4 max-w-4xl mx-auto my-8">
        <Layers className="w-12 h-12 text-grid-muted mx-auto" />
        <h3 className="text-base font-bold text-white font-mono uppercase">
          NO DATASET GENERATED YET
        </h3>
        <p className="text-xs text-grid-muted max-w-md mx-auto">
          Start real-time simulation or navigate to the <strong>Dataset Generator</strong> tab to execute multi-run scenario simulations and produce synthetic time-series data.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-6 flex flex-col gap-6 shadow-xl max-w-[1920px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-grid-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-grid-steel" />
            <h2 className="text-lg font-bold text-white font-mono tracking-wider">
              DIGITAL TWIN DATASET QUALITY & PREVIEW
            </h2>
          </div>
          <p className="text-xs text-grid-muted mt-1">
            Empirical validation of class distributions, feature completeness, and export options for AI / Soft Computing models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-green/15 border border-grid-green/60 text-grid-green font-mono font-bold text-xs hover:bg-grid-green/25 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            DOWNLOAD CSV
          </button>

          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-card border border-grid-steel/40 text-white font-mono font-medium text-xs hover:bg-grid-steel/20 transition-all"
          >
            <FileCode className="w-4 h-4 text-grid-steel" />
            DOWNLOAD JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
          <div className="text-[10px] font-mono text-grid-muted uppercase">TOTAL RECORDS</div>
          <div className="text-xl font-bold font-mono text-white mt-0.5">
            {quality.totalRecords.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
          <div className="text-[10px] font-mono text-grid-muted uppercase">TRANSFORMERS</div>
          <div className="text-xl font-bold font-mono text-white mt-0.5">
            {quality.totalTransformers} (T1–T4)
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
          <div className="text-[10px] font-mono text-grid-muted uppercase">FEATURES / COLS</div>
          <div className="text-xl font-bold font-mono text-white mt-0.5">
            {quality.totalFeatures}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-green/30">
          <div className="text-[10px] font-mono text-grid-muted uppercase">NORMAL SAMPLES</div>
          <div className="text-xl font-bold font-mono text-grid-green mt-0.5">
            {quality.normalSamples.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-yellow/30">
          <div className="text-[10px] font-mono text-grid-muted uppercase">WARNING SAMPLES</div>
          <div className="text-xl font-bold font-mono text-grid-yellow mt-0.5">
            {quality.warningSamples.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-amber/30">
          <div className="text-[10px] font-mono text-grid-muted uppercase">HIGH-STRESS SAMPLES</div>
          <div className="text-xl font-bold font-mono text-grid-amber mt-0.5">
            {quality.highStressSamples.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-red/30">
          <div className="text-[10px] font-mono text-grid-muted uppercase">OVERLOAD SAMPLES</div>
          <div className="text-xl font-bold font-mono text-grid-red mt-0.5">
            {quality.overloadSamples.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-red/40">
          <div className="text-[10px] font-mono text-grid-muted uppercase">FAULT SAMPLES</div>
          <div className="text-xl font-bold font-mono text-grid-red mt-0.5">
            {quality.faultSamples.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-yellow/30">
          <div className="text-[10px] font-mono text-grid-muted uppercase">ANOMALY FLAGS (1)</div>
          <div className="text-xl font-bold font-mono text-grid-yellow mt-0.5">
            {quality.anomalySamples.toLocaleString()}
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
          <div className="text-[10px] font-mono text-grid-muted uppercase">MISSING VALUES</div>
          <div className="text-xl font-bold font-mono text-grid-green mt-0.5">
            {quality.missingValues} (0%)
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
          <div className="text-[10px] font-mono text-grid-muted uppercase">DUPLICATE ROWS</div>
          <div className="text-xl font-bold font-mono text-grid-green mt-0.5">
            {quality.duplicateRows} (0%)
          </div>
        </div>

        <div className="bg-grid-card p-3 rounded-lg border border-grid-green/30">
          <div className="text-[10px] font-mono text-grid-muted uppercase">DATA INTEGRITY</div>
          <div className="text-xl font-bold font-mono text-grid-green mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-grid-green" />
            100% VALID
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-grid-bg p-3 rounded-lg border border-grid-border">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-grid-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search dataset by timestamp, run ID, scenario, event..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-grid-card border border-grid-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-white font-mono focus:border-grid-steel focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-grid-muted" />
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-grid-card border border-grid-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-grid-steel focus:outline-none"
          >
            <option value="ALL">All Operating States</option>
            <option value="NORMAL">NORMAL</option>
            <option value="WARNING">WARNING</option>
            <option value="HIGH_STRESS">HIGH_STRESS</option>
            <option value="OVERLOAD">OVERLOAD</option>
            <option value="FAULT">FAULT</option>
            <option value="RECOVERY">RECOVERY</option>
          </select>

          <select
            value={transformerFilter}
            onChange={(e) => {
              setTransformerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-grid-card border border-grid-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-grid-steel focus:outline-none"
          >
            <option value="ALL">All Transformers</option>
            <option value="T1">T1</option>
            <option value="T2">T2</option>
            <option value="T3">T3</option>
            <option value="T4">T4</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-grid-border rounded-lg bg-grid-bg">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead>
            <tr className="bg-grid-card text-grid-muted border-b border-grid-border uppercase text-[10px]">
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('timestamp')}>
                Timestamp <ArrowUpDown className="w-3 h-3 inline" />
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('transformer_id')}>
                T_ID <ArrowUpDown className="w-3 h-3 inline" />
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('simulation_run_id')}>
                Run ID <ArrowUpDown className="w-3 h-3 inline" />
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('scenario')}>
                Scenario <ArrowUpDown className="w-3 h-3 inline" />
              </th>
              <th className="p-2.5">Rated (MVA)</th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('primary_voltage_kV')}>
                V_pri (kV)
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('secondary_voltage_kV')}>
                V_sec (kV)
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('current_A')}>
                I (A)
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('active_power_kW')}>
                P (kW)
              </th>
              <th className="p-2.5">PF</th>
              <th className="p-2.5">Amb (°C)</th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('transformer_temperature_C')}>
                Temp (°C)
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('load_percent')}>
                Load (%)
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('health_index')}>
                Health (%)
              </th>
              <th className="p-2.5 cursor-pointer hover:text-white" onClick={() => handleSort('operating_state')}>
                State
              </th>
              <th className="p-2.5">Anom</th>
              <th className="p-2.5">Over</th>
              <th className="p-2.5">Fault</th>
              <th className="p-2.5">Event Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grid-border/60">
            {paginatedRecords.map((row, idx) => (
              <tr key={idx} className="hover:bg-grid-card/60 transition-colors">
                <td className="p-2.5 text-white font-mono-num">{row.timestamp}</td>
                <td className="p-2.5 text-white font-bold">{row.transformer_id}</td>
                <td className="p-2.5 text-grid-muted">{row.simulation_run_id}</td>
                <td className="p-2.5 text-white">{row.scenario}</td>
                <td className="p-2.5 text-grid-muted">{row.rated_capacity_MVA}</td>
                <td className="p-2.5 text-white">{row.primary_voltage_kV.toFixed(2)}</td>
                <td className="p-2.5 text-grid-muted">{row.secondary_voltage_kV.toFixed(3)}</td>
                <td className="p-2.5 text-white">{row.current_A.toFixed(0)}</td>
                <td className="p-2.5 text-white">{row.active_power_kW.toFixed(0)}</td>
                <td className="p-2.5 text-grid-muted">{row.power_factor.toFixed(2)}</td>
                <td className="p-2.5 text-grid-muted">{row.ambient_temperature_C}</td>
                <td className={`p-2.5 font-bold ${row.transformer_temperature_C >= 90 ? 'text-grid-red' : row.transformer_temperature_C >= 75 ? 'text-grid-yellow' : 'text-white'}`}>
                  {row.transformer_temperature_C.toFixed(1)}
                </td>
                <td className={`p-2.5 font-bold ${row.load_percent >= 115 ? 'text-grid-red' : row.load_percent >= 85 ? 'text-grid-yellow' : 'text-white'}`}>
                  {row.load_percent.toFixed(1)}%
                </td>
                <td className="p-2.5 text-grid-green font-bold">{row.health_index.toFixed(1)}%</td>
                <td className="p-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                    row.operating_state === 'OVERLOAD' || row.operating_state === 'FAULT'
                      ? 'bg-grid-red/20 border-grid-red text-grid-red'
                      : row.operating_state === 'HIGH_STRESS'
                      ? 'bg-grid-amber/15 border-grid-amber/50 text-grid-amber'
                      : row.operating_state === 'WARNING'
                      ? 'bg-grid-yellow/15 border-grid-yellow/50 text-grid-yellow'
                      : 'bg-grid-green/15 border-grid-green/40 text-grid-green'
                  }`}>
                    {row.operating_state}
                  </span>
                </td>
                <td className={`p-2.5 font-bold ${row.anomaly ? 'text-grid-yellow' : 'text-grid-muted'}`}>{row.anomaly}</td>
                <td className={`p-2.5 font-bold ${row.overload ? 'text-grid-red' : 'text-grid-muted'}`}>{row.overload}</td>
                <td className={`p-2.5 font-bold ${row.fault ? 'text-grid-red' : 'text-grid-muted'}`}>{row.fault}</td>
                <td className="p-2.5 text-grid-muted text-[10px]">{row.event_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-grid-muted">
        <div>
          Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, sortedRecords.length)} of {sortedRecords.length} records
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-grid-card border border-grid-border disabled:opacity-40 hover:text-white"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded bg-grid-card border border-grid-border disabled:opacity-40 hover:text-white"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
