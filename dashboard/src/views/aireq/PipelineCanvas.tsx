import { useState } from "react";
import { Card } from "../../components";
import {
  DEFAULT_MAIL, JobReq, MailConfig, Stage, STAGE_PRESETS, StagePreset, nid,
} from "./model";
import StageLibrary from "./StageLibrary";
import FlowCanvas from "./FlowCanvas";
import StageDetail from "./StageDetail";
import MailEditor from "./MailEditor";

/**
 * Visual drag-and-drop pipeline builder — orchestrator.
 * Left  = stage library (click / drag to add before "Hired").
 * Centre = connected flow nodes (difficulty · pass % · eval type · candidate bars).
 * Right = detail panel + per-stage mail configuration.
 */
export default function PipelineCanvas({ job, onChange }: { job: JobReq; onChange: (j: JobReq) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editingMail, setEditingMail] = useState<string | null>(null);
  const [mailDraft, setMailDraft] = useState<MailConfig | null>(null);

  const setStages = (stages: Stage[]) => onChange({ ...job, stages });
  const stage = job.stages.find((s) => s.id === selected) ?? null;

  // ── Stage operations ──────────────────────────────────────────────
  const addStage = (preset: StagePreset) => {
    const hired = job.stages[job.stages.length - 1];
        const newStage: Stage = {
      id: nid("st"), name: preset.name, icon: preset.icon, criteria: preset.criteria,
      evalType: preset.evalType, difficulty: preset.difficulty,
      failLabel: `${preset.name} Failed`, mail: { ...DEFAULT_MAIL },
    };
    const rest = job.stages.filter((s) => s.id !== hired.id);
    setStages([...rest, newStage, hired]);
    setSelected(newStage.id);
  };

  const updateStage = (id: string, patch: Partial<Stage>) =>
    setStages(job.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeStage = (id: string) => {
    setStages(job.stages.filter((s) => s.id !== id));
    if (selected === id) setSelected(null);
  };

  const moveStage = (id: string, dir: -1 | 1) => {
    const idx = job.stages.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (idx <= 0 || j <= 0 || j >= job.stages.length - 1) return; // Applied & Hired pinned
    const next = [...job.stages];
    [next[idx], next[j]] = [next[j], next[idx]];
    setStages(next);
  };

  // ── Mail configuration ────────────────────────────────────────────
  const openMail = (id: string) => {
    const s = job.stages.find((x) => x.id === id);
    if (!s) return;
    setEditingMail(id);
    setMailDraft(s.mail ? { ...s.mail, currentStage: { ...s.mail.currentStage }, nextStage: { ...s.mail.nextStage } } : { ...DEFAULT_MAIL });
  };

  const saveMail = () => {
    if (!editingMail || !mailDraft) return;
    updateStage(editingMail, { mail: mailDraft });
    setEditingMail(null);
    setMailDraft(null);
  };

  const resetMail = () => setMailDraft({ ...DEFAULT_MAIL });

  // ── Drop from library onto canvas (insert before Hired) ───────────
  const onLibDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const name = e.dataTransfer.getData("text/plain");
    const preset = STAGE_PRESETS.find((p) => p.name === name);
    if (preset) addStage(preset);
  };

  return (
    <Card style={{ marginBottom: 18 }}>
      <div className="card-head">
        <h3>🎨 Pipeline builder</h3>
        <span className="chip">{job.stages.length} stages</span>
      </div>

      <div className="jr-builder">
        {/* Left: stage library */}
        <StageLibrary onAdd={addStage} />

        {/* Centre: flow canvas */}
        <div className="jr-builder-center" onDragOver={(e) => e.preventDefault()} onDrop={onLibDrop}>
          <FlowCanvas
            job={job}
            selected={selected}
            onSelect={setSelected}
            onDrop={() => {}}
            onMove={moveStage}
            onRemove={removeStage}
            onOpenMail={openMail}
          />
        </div>

        {/* Right: detail + mail */}
        <div className="jr-builder-right">
          {stage ? (
            editingMail === stage.id ? (
              <MailEditor
                stage={stage}
                draft={mailDraft!}
                setDraft={setMailDraft}
                onSave={saveMail}
                onReset={resetMail}
                onClose={() => { setEditingMail(null); setMailDraft(null); }}
              />
            ) : (
              <StageDetail
                stage={stage}
                onUpdate={(patch) => updateStage(stage.id, patch)}
                onOpenMail={() => openMail(stage.id)}
              />
            )
          ) : (
            <div className="jr-empty">← Select a stage to configure its criteria, difficulty, eval type and mail templates</div>
          )}
        </div>
      </div>
    </Card>
  );
}
