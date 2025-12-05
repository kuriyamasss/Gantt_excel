// frontend/src/hooks/useConnections.js
import { useState, useEffect } from "react";
import axios from "axios";

export default function useConnections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadConnections() {
    setLoading(true);
    try {
      const res = await axios.get("/api/connections");
      setConnections(res.data.connections || []);
    } catch (err) {
      console.error("loadConnections error", err);
    } finally {
      setLoading(false);
    }
  }

  async function createConnection(conn) {
    try {
      const res = await axios.post("/api/connections", conn);
      if (res.data && res.data.ConnID) {
        await loadConnections();
        return res.data.ConnID;
      }
    } catch (err) {
      console.error("createConnection error", err);
    }
  }

  async function deleteConnection(connID) {
    try {
      await axios.delete(`/api/connections/${connID}`);
      await loadConnections();
    } catch (err) {
      console.error("deleteConnection error", err);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  return { connections, loading, loadConnections, createConnection, deleteConnection };
}
