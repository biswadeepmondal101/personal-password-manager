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
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(
    new Set(),
  );

  // 1. Fetch all passwords when you click the extension puzzle piece
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "get_all" }, (response) => {
      if (chrome.runtime.lastError) {
        setError("Extension communication error.");
        setLoading(false);
        return;
      }
      console.log("responce", response);

      if (response && response.status === "success") {
        setVault(response.data);
      } else {
        setError(response?.message || "Failed to load vault data.");
      }
      setLoading(false);
    });
  }, []);

  // 2. The Delete Function
  const deleteCredential = (id: number) => {
    // Ask Python to delete it from the SQLite Database
    chrome.runtime.sendMessage(
      { action: "delete_credential", payload: { id } },
      (response) => {
        if (response && response.status === "success") {
          // If Python succeeds, instantly remove it from the React UI without refreshing
          setVault((prevVault) => prevVault.filter((cred) => cred.id !== id));
        } else {
          alert("Failed to delete credential!");
        }
      },
    );
  };

  const togglePassword = (id: number) => {
    setRevealedPasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const copyToClipboard = async (text: string | undefined) => {
    if (text) await navigator.clipboard.writeText(text);
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
        backgroundColor: "#020a1f",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          color: "#333",
          borderBottom: "2px solid #ddd",
          paddingBottom: "10px",
        }}
      >
        🛡️ Native Vault
      </h2>

      {vault.length === 0 ? (
        <p style={{ textAlign: "center", color: "#666", marginTop: "30px" }}>
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
                backgroundColor: "white",
                padding: "12px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  color: "#0056b3",
                  marginBottom: "5px",
                  fontSize: "14px",
                  wordBreak: "break-all",
                }}
              >
                {cred.url}
              </div>

              <div
                style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}
              >
                {cred.username || "No username saved"}
              </div>

              <div style={{ display: "flex", gap: "5px" }}>
                <input
                  type={revealedPasswords.has(cred.id) ? "text" : "password"}
                  value={cred.password || ""}
                  readOnly
                  style={{
                    flex: 1,
                    padding: "5px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    backgroundColor: "#f1f1f1",
                  }}
                />

                {/* View Button */}
                <button
                  onClick={() => togglePassword(cred.id)}
                  style={{
                    cursor: "pointer",
                    padding: "5px 8px",
                    border: "none",
                    backgroundColor: "#e0e0e0",
                    borderRadius: "4px",
                  }}
                >
                  {revealedPasswords.has(cred.id) ? "👁️" : "🙈"}
                </button>

                {/* Copy Button */}
                <button
                  onClick={() => copyToClipboard(cred.password)}
                  style={{
                    cursor: "pointer",
                    padding: "5px 8px",
                    border: "none",
                    backgroundColor: "#0056b3",
                    color: "white",
                    borderRadius: "4px",
                  }}
                >
                  Copy
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => deleteCredential(cred.id)}
                  style={{
                    cursor: "pointer",
                    padding: "5px 8px",
                    border: "none",
                    backgroundColor: "#dc3545",
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
