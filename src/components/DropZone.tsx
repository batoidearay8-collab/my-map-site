import React, { useCallback, useRef, useState } from "react";

export function DropZone(props: {
  title: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
  hint?: string;
  buttonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOver, setIsOver] = useState(false);

  const open = useCallback(() => inputRef.current?.click(), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    if (e.dataTransfer.files?.length) props.onFiles(e.dataTransfer.files);
  }, [props]);

  return (
    <div
      className="card"
      style={{ borderStyle: "dashed", borderColor: isOver ? "rgba(110,168,254,0.55)" : undefined }}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 900 }}>{props.title}</div>
          {props.hint ? <div className="hint">{props.hint}</div> : null}
        </div>
        <button className="btn" onClick={open}>{props.buttonLabel ?? "Choose"}</button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        multiple={props.multiple}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) props.onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
