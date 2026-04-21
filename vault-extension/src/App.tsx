import { useState, useEffect } from "react";

interface CredentialData {
  id: number;
  url: string;
  username: string;
  password?: string;
}

export default function App() {
  const [vault, setVault] = useState<CredentialData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "get_all" }, (response) => {
      if (chrome.runtime.lastError) {
        setError("Extension communication error.");
        setLoading(false);
        return;
      }
      if (response && response.status === "success") {
        setVault(response.data);
      } else {
        setError(response?.message || "Failed to load vault data.");
      }
      setLoading(false);
    });
  }, []);

  const deleteCredential = (id: number) => {
    chrome.runtime.sendMessage(
      { action: "delete_credential", payload: { id } },
      (response) => {
        if (response && response.status === "success") {
          setVault((prevVault) => prevVault.filter((cred) => cred.id !== id));
        } else {
          alert("Failed to delete credential!");
        }
      },
    );
  };

  // UI Layout
  if (loading)
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Unlocking Vault...
      </div>
    );
  if (error)
    return (
      <div style={{ padding: "20px", color: "red", textAlign: "center" }}>
        Error:
        {error}
      </div>
    );

  return (
    <div
      style={{
        width: "380px",
        minHeight: "400px",
        padding: "15px",
        fontFamily: "sans-serif",
        backgroundColor: "#1e1e24",
        color: "#f8f9fa",
        borderRadius: "12px", // Makes the outer edges rounded
        border: "1px solid #3f3f46", // Defines the edge (required for rounded corners to look sharp)
        overflow: "hidden",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          color: "#10b981", // Emerald Green
          borderBottom: "2px solid #3f3f46",
          paddingBottom: "10px",
          marginTop: "5px",
          letterSpacing: "1px",
        }}
      >
        🛡️ Password Vault
      </h2>

      {vault.length === 0 ? (
        <p style={{ textAlign: "center", color: "#9ca3af", marginTop: "30px" }}>
          Your vault is empty.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "15px",
          }}
        >
          {vault.map((cred) => (
            <div
              key={cred.id}
              style={{
                backgroundColor: "#2b2b36",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #3f3f46",
                boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  color: "#10b981",
                  marginBottom: "5px",
                  fontSize: "14px",
                  wordBreak: "break-all",
                }}
              >
                {cred.url}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginBottom: "8px",
                }}
              >
                {cred.username || "No username saved"}
              </div>

              <div style={{ display: "flex", gap: "5px" }}>
                <input
                  type="password"
                  value={cred.password || ""}
                  readOnly
                  style={{
                    flex: 1,
                    padding: "5px",
                    border: "1px solid #3f3f46",
                    borderRadius: "4px",
                    backgroundColor: "#1e1e24", // Dark input background
                    color: "#f8f9fa", // White password text
                    outline: "none",
                  }}
                />
                {/* Delete Button */}
                <button
                  onClick={() => deleteCredential(cred.id)}
                  style={{
                    cursor: "pointer",
                    padding: "5px 8px",
                    border: "none",
                    backgroundColor: "#ef4444",
                    color: "white",
                    borderRadius: "4px",
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
