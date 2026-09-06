import { useEffect, useState } from "react";
import { api } from "../api";
import { Avatar, Button, Card, EmptyState } from "../components";
import { navigate } from "../router";

interface Bot {
  id: string;
  name: string;
  gender: "male" | "female";
  specialization: string;
  accent?: string;
  primary_language?: string;
  avatar?: string | null;
}

const TOPICS = [
  "Outbound sales",
  "Follow-ups & reminders",
  "Renewal / churn win-back",
  "Surveys & feedback",
  "Lead qualification",
  "Appointment booking",
];

export default function AiVoiceBot() {
  const [agents, setAgents] = useState<Bot[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAgents()
      .then((list) => setAgents(list.slice(0, 6)))
      .catch((e) => setErr(String(e).slice(0, 200)));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>🤖 AI Voice Bot</h2>
          <div className="sub">Configure purpose-built voice bots — then launch them from a campaign or the Voice Lab</div>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" onClick={() => navigate("agents")}>Manage agents</Button>
          <Button onClick={() => navigate("voicelab")}>🎤 Try the Voice Lab</Button>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <div className="vb-topics">
        {TOPICS.map((t) => (
          <span className="chip on" key={t}>🎯 {t}</span>
        ))}
      </div>

      {agents.length === 0 && !err ? (
        <Card><EmptyState icon="🤖" title="Loading agents…" /></Card>
      ) : (
        <div className="vb-grid">
          {agents.map((a) => (
            <Card key={a.id} className="vb-bot" onClick={() => navigate(`voicelab/${a.id}`)}>
              <div className="vb-head">
                <Avatar name={a.name} avatar={a.avatar} size={46} />
                <div>
                  <b>{a.name}</b>
                  <em>{a.accent ?? "Indian accent"} · {a.primary_language ?? "auto"}</em>
                </div>
              </div>
              <div className="vb-spec">{a.specialization}</div>
              <div className="vb-foot">
                <span className={`gender-tag ${a.gender}`}>{a.gender}</span>
                <span>▶ Talk now</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card title="🗣 How a voice bot works" style={{ marginTop: 20 }}>
        <div className="vb-how">
          {[
            ["1", "You call / browser starts the Voice Lab", "VAD + STT wake the agent"],
            ["2", "Agent listens & thinks", "LLM with persona, tools and language switching"],
            ["3", "Agent replies with speech", "TTS with barge-in if you interrupt"],
            ["4", "Call resolves", "Transcript, outcome, lead score & CRM move saved"],
          ].map(([n, t, s]) => (
            <div className="vb-step" key={n}>
              <span className="vb-num">{n}</span>
              <div><b>{t}</b>{s && <em>{s}</em>}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}