import { useEffect, useRef } from "react";
import Modal from "../Modal";
import PMProjectControlPanel from "./PMProjectControlPanel";
import "./PMProjectControlModal.css";

export default function PMProjectControlModal({ project, control, isLoading, error, onClose, onRefresh, onOpenRequirements, aiEnabled = false, explanations = {}, onExplain }) {
  const displayedProject = control?.project || project;
  const subtitle = displayedProject ? `${displayedProject.name} · ${displayedProject.status}` : "Loading project attention…";
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [displayedProject?.id]);

  return (
    <Modal
      title="Project Control"
      subtitle={subtitle}
      onClose={onClose}
      headerActions={(
        <button type="button" onClick={onRefresh} className="project-control-refresh" autoFocus>
          <RefreshIcon />
          Refresh attention
        </button>
      )}
      panelClassName="project-control-modal"
      headerClassName="project-control-modal-header"
      lockDocumentScroll
    >
      <div ref={bodyRef} className="project-control-modal-body">
        <PMProjectControlPanel
          control={control}
          isLoading={isLoading}
          error={error}
          onRefresh={onRefresh}
          onOpenRequirements={() => onOpenRequirements?.(displayedProject)}
          onClose={onClose}
          aiEnabled={aiEnabled}
          explanations={explanations}
          onExplain={onExplain}
          embedded
          hideHeader
        />
      </div>
    </Modal>
  );
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8.5A7 7 0 0 1 18.8 7M5.2 17A7 7 0 0 0 17.9 15.5" /></svg>;
}
