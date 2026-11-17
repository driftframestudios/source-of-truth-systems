import { CORRIDOR_PITCH, CORRIDOR_PRESETS, displayCorridorYaw, nearestCorridorYaw } from "../corridor/corridorCamera";
import type { CorridorPreset } from "../corridor/corridorCamera";
import { X } from "lucide-react";
import { STORE } from "../../data";
import type { LaneId } from "../../types";
import {
  cardStyle,
  FLAG_STYLE,
  PENNANT_COLOR,
} from "../corridor/CorridorScene";
import {
  CARD_KINDS,
  CORRIDOR_STAGES,
  INITIAL_CORRIDOR_VIEW,
  toggleSet,
} from "./corridorView";
import type { CorridorView, MobileCorridorCamera } from "./corridorView";

export function MobileCorridorExplorer({
  view,
  onView,
  camera,
  onCamera,
  onPreset,
  yawBase,
  onLane,
  onClose,
}: {
  view: CorridorView;
  onView: (view: CorridorView) => void;
  camera: MobileCorridorCamera;
  onCamera: (camera: MobileCorridorCamera) => void;
  onPreset: (preset: CorridorPreset) => void;
  yawBase: number;
  onLane: (id: LaneId) => void;
  onClose: () => void;
}) {
  return (
    <div className="mobile-corridor-detail-inner mobile-corridor-explorer">
      <header className="mobile-corridor-detail-heading">
        <h2 id="mobile-corridor-detail-title">Explore the corridor</h2>
        <button
          autoFocus
          type="button"
          aria-label="Close corridor controls"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <label className="mobile-corridor-search">
        Find a workflow record
        <input
          type="search"
          value={view.query}
          placeholder="Name, note or ID"
          onChange={(event) => onView({ ...view, query: event.target.value })}
        />
      </label>
      <fieldset>
        <legend>Scope</legend>
        <div className="mobile-corridor-options">
          {(["lane", "overview"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={view.mode === mode}
              onClick={() => onView({ ...view, mode })}
            >
              {mode === "lane" ? "One lane" : "All lanes"}
            </button>
          ))}
        </div>
        <label>
          Overview stage
          <select
            value={view.stage}
            onChange={(event) =>
              onView({
                ...view,
                mode: "overview",
                stage: event.target.value as CorridorView["stage"],
              })
            }
          >
            <option value="all">All stages</option>
            {CORRIDOR_STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <details>
        <summary>Lanes · show, focus and inspect</summary>
        <div className="mobile-corridor-lane-options">
          {STORE.lanes.map((lane) => (
            <div key={lane.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!view.hidden.has(lane.id)}
                  onChange={() =>
                    onView({ ...view, hidden: toggleSet(view.hidden, lane.id) })
                  }
                />
                <span style={{ color: lane.color }}>{lane.label}</span>
              </label>
              <button
                aria-label={`Focus ${lane.label}`}
                onClick={() => onLane(lane.id)}
              >
                Focus
              </button>
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary>Layers and drafting key</summary>
        <div className="mobile-corridor-layer-options">
          {CARD_KINDS.map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={!view.hideKinds.has(kind)}
                onChange={() =>
                  onView({
                    ...view,
                    hideKinds: toggleSet(view.hideKinds, kind),
                  })
                }
              />
              <i style={{ background: cardStyle(kind).bg }} />
              {cardStyle(kind).label}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={view.showArrows}
              onChange={() => onView({ ...view, showArrows: !view.showArrows })}
            />
            Cross-lane arrows
          </label>
        </div>
        <h3>Lane flags</h3>
        <div className="mobile-corridor-detail-tags">
          {Object.entries(FLAG_STYLE).map(([kind, style]) => (
            <span key={kind} style={{ borderLeft: `4px solid ${style.bg}` }}>
              {kind}
            </span>
          ))}
        </div>
        <h3>Pennants</h3>
        <div className="mobile-corridor-detail-tags">
          {Object.entries(PENNANT_COLOR).map(([kind, style]) => (
            <span key={kind} style={{ borderLeft: `4px solid ${style.bg}` }}>
              {kind.toUpperCase()}
            </span>
          ))}
        </div>
        <p>
          Paper cards mark processes; colored placards mark states. Flags mark
          milestones, gates and handoffs. Arrows connect the visible records.
        </p>
      </details>
      <details>
        <summary>Camera · presets and angles</summary>
        <div className="mobile-corridor-options">
          {CORRIDOR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label>
          Pitch · {Math.round(camera.pitch)}°
          <input
            type="range"
            min={CORRIDOR_PITCH.min}
            max={CORRIDOR_PITCH.max}
            step="0.1"
            value={camera.pitch}
            onChange={(event) =>
              onCamera({ ...camera, pitch: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Yaw · {Math.round(displayCorridorYaw(camera.yaw + yawBase))}°
          <input
            type="range"
            min="-180"
            max="180"
            step="0.1"
            value={displayCorridorYaw(camera.yaw + yawBase)}
            onChange={(event) =>
              onCamera({ ...camera, yaw: nearestCorridorYaw(Number(event.target.value), camera.yaw + yawBase) - yawBase })
            }
          />
        </label>
      </details>
      <details>
        <summary>Streams</summary>
        {STORE.streams.map((stream) => (
          <div className="mobile-corridor-related" key={stream.id}>
            <strong>{stream.label}</strong>
            <span>
              {stream.format} · {stream.approxSize}
            </span>
            <p>
              {
                STORE.lanes.find((lane) => lane.id === stream.producedByLane)
                  ?.label
              }{" "}
              →{" "}
              {STORE.lanes.find((lane) => lane.id === stream.consumedByLane)
                ?.label ?? "Output"}
            </p>
          </div>
        ))}
      </details>
      <div className="mobile-corridor-detail-footer">
        <button onClick={() => onView(INITIAL_CORRIDOR_VIEW)}>
          Reset view filters
        </button>
        <button onClick={onClose}>Show corridor</button>
      </div>
    </div>
  );
}
