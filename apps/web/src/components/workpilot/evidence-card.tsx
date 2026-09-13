type EvidenceCardProps = {
  text: string;
};

export function EvidenceCard({ text }: EvidenceCardProps) {
  return (
    <div
      style={{
        padding: "10px",
        border: "1px solid #374151",
        borderRadius: "8px",
        color: "#d1d5db",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}