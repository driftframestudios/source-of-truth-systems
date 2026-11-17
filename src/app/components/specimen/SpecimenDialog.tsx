import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useRef } from "react";
import type { Specimen } from "../../types";
import { TOPICS, type SpecimenTopic } from "./specimenCollection";
import { SpecimenDetails } from "./SpecimenDetails";

export interface SpecimenSelection {
  id: string;
  topic: SpecimenTopic;
  origin: { x: number; y: number };
}
const TOPIC_KEYS = Object.keys(TOPICS) as SpecimenTopic[];
const SPRING = {
  type: "spring" as const,
  stiffness: 310,
  damping: 29,
  mass: 0.85,
};
export function SpecimenDialog({
  selection,
  specimens,
  allSpecimens,
  returnFocus,
  onTopic,
  onRecord,
  onClose,
}: {
  selection: SpecimenSelection | null;
  specimens: readonly Specimen[];
  allSpecimens: readonly Specimen[];
  returnFocus: () => void;
  onTopic: (topic: SpecimenTopic) => void;
  onRecord: (id: string) => void;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedIndex = specimens.findIndex(
    (item) => item.id === selection?.id,
  );
  const selected = allSpecimens.find((item) => item.id === selection?.id);
  const offset = selection
    ? {
        x: Math.max(-240, Math.min(240, selection.origin.x - innerWidth / 2)),
        y: Math.max(-180, Math.min(180, selection.origin.y - innerHeight / 2)),
      }
    : { x: 0, y: 0 };
  return (
    <Dialog.Root
      open={Boolean(selected && selection)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {selected && selection && (
            <div key="specimen-dialog">
              <Dialog.Overlay forceMount asChild>
                <motion.div
                  className="specimen-dialog-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.16 }}
                />
              </Dialog.Overlay>
              <div className="specimen-dialog-position">
                <Dialog.Content
                  forceMount
                  asChild
                  onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    heading.current?.focus();
                  }}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    returnFocus();
                  }}
                >
                  <motion.section
                    className="specimen-dialog specimen-surface"
                    initial={
                      reducedMotion
                        ? false
                        : { opacity: 0, scale: 0.78, ...offset }
                    }
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.9, ...offset }
                    }
                    transition={reducedMotion ? { duration: 0 } : SPRING}
                  >
                    <header className="specimen-dialog__rail">
                      <div>
                        <Dialog.Title ref={heading} tabIndex={-1}>
                          {selected.id}
                        </Dialog.Title>
                        <Dialog.Description>
                          {selected.patientCode} · {selected.indication}
                        </Dialog.Description>
                      </div>
                      <Dialog.Close aria-label="Close specimen details">
                        <X size={17} aria-hidden="true" />
                      </Dialog.Close>
                    </header>
                    <nav
                      className="specimen-dialog__topics"
                      aria-label="Specimen detail topics"
                    >
                      {TOPIC_KEYS.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          aria-current={
                            selection.topic === topic ? "page" : undefined
                          }
                          onClick={() => onTopic(topic)}
                        >
                          {TOPICS[topic]}
                        </button>
                      ))}
                    </nav>
                    <div className="specimen-dialog__body">
                      <h3>{TOPICS[selection.topic]}</h3>
                      <SpecimenDetails
                        specimen={selected}
                        topic={selection.topic}
                      />
                    </div>
                    <footer className="specimen-dialog__footer">
                      <button
                        type="button"
                        disabled={selectedIndex <= 0}
                        onClick={() =>
                          onRecord(specimens[selectedIndex - 1].id)
                        }
                      >
                        <ArrowLeft size={13} aria-hidden="true" />
                        Previous specimen
                      </button>
                      <span>
                        {selectedIndex < 0
                          ? "Outside current filters"
                          : `${selectedIndex + 1} of ${specimens.length} in view`}
                      </span>
                      <button
                        type="button"
                        disabled={
                          selectedIndex < 0 ||
                          selectedIndex >= specimens.length - 1
                        }
                        onClick={() =>
                          onRecord(specimens[selectedIndex + 1].id)
                        }
                      >
                        Next specimen
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </footer>
                  </motion.section>
                </Dialog.Content>
              </div>
            </div>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
