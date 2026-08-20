export default function Loading() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: "14px",
    }}>
      <div style={{
        width: "36px",
        height: "36px",
        border: "3px solid #e3e9e4",
        borderTopColor: "#11251a",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#9aa49d", fontWeight: 700 }}>
        LOADING…
      </p>
    </div>
  );
}
