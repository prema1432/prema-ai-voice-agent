import { Button } from "../../components";
import { MailConfig, Stage } from "./model";

/** Per-stage mail configuration panel (current-stage + next-stage templates). */
export default function MailEditor({
  stage,
  draft,
  setDraft,
  onSave,
  onReset,
  onClose,
}: {
  stage: Stage;
  draft: MailConfig;
  setDraft: (d: MailConfig) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="jr-mail-editor">
      <div className="card-head">
        <h3>✉️ Mail — {stage.name}</h3>
        <Button size="sm" onClick={onClose}>✕</Button>
      </div>
      <div className="jr-detail-body">
        <div>
          <label className="lbl">Current-stage mail subject</label>
          <input className="input" value={draft.currentStage.subject} onChange={(e) => setDraft({ ...draft, currentStage: { ...draft.currentStage, subject: e.target.value } })} />
        </div>
        <div>
          <label className="lbl">Current-stage mail body</label>
          <textarea className="input" rows={4} value={draft.currentStage.body} onChange={(e) => setDraft({ ...draft, currentStage: { ...draft.currentStage, body: e.target.value } })} />
        </div>
        <div>
          <label className="lbl">Next-stage mail subject</label>
          <input className="input" value={draft.nextStage.subject} onChange={(e) => setDraft({ ...draft, nextStage: { ...draft.nextStage, subject: e.target.value } })} />
        </div>
        <div>
          <label className="lbl">Next-stage mail body</label>
          <textarea className="input" rows={4} value={draft.nextStage.body} onChange={(e) => setDraft({ ...draft, nextStage: { ...draft.nextStage, body: e.target.value } })} />
        </div>
        <div className="jr-mail-vars">
          Variables: <code>{"{{name}}"}</code> <code>{"{{stage}}"}</code> <code>{"{{nextStage}}"}</code> <code>{"{{score}}"}</code> <code>{"{{job}}"}</code>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" size="sm" onClick={onSave}>💾 Save mail</Button>
          <Button size="sm" onClick={onReset}>↺ Reset template</Button>
        </div>
      </div>
    </div>
  );
}